// Tests Node du cœur (parseur, modèle, diff, reconstruction depuis un diff unifié).
// Lancement : node test/run.js

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const X = require("../src/xml.js");
const M = require("../src/model.js");
const D = require("../src/diff.js");
const G = require("../src/github.js");
const L = require("../src/lines.js");

const FIX = path.join(__dirname, "fixtures");
// Fixtures lues en LF sans BOM ; CRLF et BOM sont testés à part (aller-retour reverseApply).
const read = (f) => fs.readFileSync(path.join(FIX, f), "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (e) {
    console.log(`FAIL ${name}\n     ${e.stack.split("\n").slice(0, 3).join("\n     ")}`);
    process.exitCode = 1;
  }
}

const keys = (m) => m.sections.map((s) => s.key);
const section = (m, key) => m.sections.find((s) => s.key === key);

test("xml : toutes les fixtures se lisent", () => {
  for (const f of fs.readdirSync(FIX)) X.parseXml(read(f));
});

test("xml : attributs avec '>' et entités, CDATA conservé tel quel", () => {
  const el = X.parseXml(`<?xml version="1.0"?><a x="1 &gt; 0" y='&amp;'><b><![CDATA[IF a<b THEN]]></b></a>`);
  assert.strictEqual(el.attrs.x, "1 > 0");
  assert.strictEqual(el.attrs.y, "&");
  assert.strictEqual(X.child(el, "b").text, "IF a<b THEN");
});

test("xml : balise mal fermée détectée", () => {
  assert.throws(() => X.parseXml("<a><b></a>"), /XML invalide/);
});

test("modèle POU : découpage déclaration, méthodes, propriétés Get/Set", () => {
  const m = M.modelFile("FB_Child.TcPOU", read("FB_InputWithPropertiesAndMethods.TcPOU"));
  assert.strictEqual(m.title, "FUNCTION_BLOCK FB_Child");
  assert.deepStrictEqual(keys(m), [
    "POU:FB_Child#attrs",
    "POU:FB_Child#decl",
    "POU:FB_Child#impl",
    "POU:FB_Child/Method:AddTwoInts#decl",
    "POU:FB_Child/Method:AddTwoInts#impl",
    "POU:FB_Child/Property:AnotherProperty#decl",
    "POU:FB_Child/Property:AnotherProperty/Get#decl",
    "POU:FB_Child/Property:AnotherProperty/Get#impl",
    "POU:FB_Child/Property:AnotherProperty/Set#decl",
    "POU:FB_Child/Property:AnotherProperty/Set#impl",
    "POU:FB_Child/Property:Counter#decl",
    "POU:FB_Child/Property:Counter/Get#decl",
    "POU:FB_Child/Property:Counter/Get#impl",
    "POU:FB_Child/Property:Counter/Set#decl",
    "POU:FB_Child/Property:Counter/Set#impl",
    "POU:FB_Child/Method:SecondMethod#decl",
    "POU:FB_Child/Method:SecondMethod#impl",
  ]);
  assert.deepStrictEqual(section(m, "POU:FB_Child#attrs").props, { SpecialFunc: "None" });
  assert.strictEqual(section(m, "POU:FB_Child/Method:AddTwoInts#impl").text, "AddTwoInts:=Variable1+Variable2 ;");
  assert.ok(m.noise.versions.includes("ProductVersion=3.1.4024.3"));
  assert.strictEqual(m.noise.guids.length, 9);
});

test("diff POU : reformatage TcBlack visible, invisible en ignorant les espaces", () => {
  const a = M.modelFile("FB_Child.TcPOU", read("FB_InputWithPropertiesAndMethods.TcPOU"));
  const b = M.modelFile("FB_Child.TcPOU", read("FB_ExpectedWithPropertiesAndMethods.TcPOU"));
  const d = D.diffModels(a, b);
  assert.strictEqual(d.status, "modified");
  assert.ok(d.sections.find((s) => s.key === "POU:FB_Child#decl").status === "modified");
  const dws = D.diffModels(a, b, { ignoreWs: true });
  assert.ok(dws.changed < d.changed, `${dws.changed} < ${d.changed}`);
});

test("diff POU : seuls LineIds, GUID et ProductVersion changent → bruit", () => {
  const src = read("FB_InputWithPropertiesAndMethods.TcPOU");
  const noisy = src
    .replace('ProductVersion="3.1.4024.3"', 'ProductVersion="3.1.4026.12"')
    .replace("{6a4e1f8c-f7f9-4983-b9b4-e06e406d35d9}", "{00000000-1111-2222-3333-444444444444}")
    .replace("  </POU>", '    <LineIds Name="FB_Child">\n      <LineId Id="3" Count="0" />\n    </LineIds>\n  </POU>');
  const d = D.diffModels(M.modelFile("a.TcPOU", src), M.modelFile("a.TcPOU", noisy));
  assert.strictEqual(d.status, "noise");
  assert.strictEqual(d.changed, 0);
  assert.deepStrictEqual(d.noise, ["LineIds", "version XAE (ProductVersion=3.1.4024.3 → ProductVersion=3.1.4026.12)", "GUID"]);
});

test("diff POU : méthode ajoutée et méthode supprimée", () => {
  const src = read("FB_InputWithPropertiesAndMethods.TcPOU");
  const changed = src.replace(/<Method Name="SecondMethod"[\s\S]*?<\/Method>\n/, "").replace(
    "  </POU>",
    '    <Method Name="Reset" Id="{11111111-1111-1111-1111-111111111111}">\n      <Declaration><![CDATA[METHOD Reset]]></Declaration>\n      <Implementation>\n        <ST><![CDATA[Counter := 0;]]></ST>\n      </Implementation>\n    </Method>\n  </POU>'
  );
  const d = D.diffModels(M.modelFile("a.TcPOU", src), M.modelFile("a.TcPOU", changed));
  const st = Object.fromEntries(d.sections.map((s) => [s.key, s.status]));
  assert.strictEqual(st["POU:FB_Child/Method:Reset#impl"], "added");
  assert.strictEqual(st["POU:FB_Child/Method:SecondMethod#decl"], "removed");
  assert.strictEqual(d.changed, 4);
});

test("modèle TcTTO : propriétés de tâche, GUID en bruit", () => {
  const m = M.modelFile("PlcTask.TcTTO", read("PlcTask.TcTTO"));
  assert.deepStrictEqual(m.sections[0].props, { CycleTime: "10000", Priority: "20", "PouCall[MAIN]": "✓" });
  const b = M.modelFile("PlcTask.TcTTO", read("PlcTask.TcTTO").replace("<CycleTime>10000", "<CycleTime>1000"));
  const d = D.diffModels(m, b);
  assert.deepStrictEqual(d.sections[0].rows[0], { t: "~", key: "CycleTime", a: "10000", b: "1000" });
});

test("modèle plcproj : groupes, et réordonner les ItemGroup ne crée pas de diff", () => {
  const src = read("PLC3.plcproj");
  const m = M.modelFile("PLC3.plcproj", src);
  const labels = m.sections.map((s) => s.label);
  for (const l of ["Propriétés du projet", "Fichiers", "Dossiers", "Bibliothèques"]) assert.ok(labels.includes(l), l);
  assert.strictEqual(section(m, "Fichiers").props["Compile[POUs\\MAIN.TcPOU]/SubType"], "Code");
  assert.strictEqual(section(m, "Bibliothèques").props["PlaceholderReference[Tc2_Standard]/Namespace"], "Tc2_Standard");
  assert.ok(!("ProjectGuid" in section(m, "Propriétés du projet").props));

  const groups = src.match(/  <ItemGroup>[\s\S]*?<\/ItemGroup>\n/g);
  const swapped = src.replace(groups[0], "@@0").replace(groups[1], groups[0]).replace("@@0", groups[1]);
  assert.notStrictEqual(swapped, src);
  assert.strictEqual(D.diffModels(m, M.modelFile("PLC3.plcproj", swapped)).changed, 0);

  const lib = src.replace("Tc2_System, * (Beckhoff", "Tc2_System, 3.4.25.0 (Beckhoff");
  const d = D.diffModels(m, M.modelFile("PLC3.plcproj", lib));
  const row = d.sections.find((s) => s.key === "Bibliothèques").rows[0];
  assert.strictEqual(row.key, "PlaceholderReference[Tc2_System]/DefaultResolution");
  assert.strictEqual(row.t, "~");
});

test("modèle tsproj : tâche identifiée par son nom", () => {
  const src = read("ShowcaseProject.tsproj");
  const m = M.modelFile("ShowcaseProject.tsproj", src);
  const sys = section(m, "Project › System › Tasks");
  assert.strictEqual(sys.props["Project/System/Tasks/Task[PlcTask]@Priority"], "20");
  const d = D.diffModels(m, M.modelFile("x.tsproj", src.replace('Priority="20" CycleTime', 'Priority="15" CycleTime')));
  assert.strictEqual(d.changed, 1);
  assert.deepStrictEqual(d.noise, []);
});

test("diffLines : ordre et numéros de ligne", () => {
  const ops = D.diffLines("a\nb\nc\nd", "a\nB\nc\nd\ne");
  assert.deepStrictEqual(
    ops.map((o) => `${o.t}${o.a || ""}:${o.b || ""} ${o.text}`),
    ["=1:1 a", "-2: b", "+:2 B", "=3:3 c", "=4:4 d", "+:5 e"]
  );
  const ctx = D.withContext(D.diffLines("1\n2\n3\n4\n5\n6\n7\n8\n9\n10", "1\n2\n3\n4\n5\n6\n7\n8\n9\nX"), 2);
  assert.strictEqual(ctx[0].t, "skip");
  assert.strictEqual(ctx[0].count, 7);
});

// Reconstruction « avant » = « après » + hunks inversés, sur de vrais diffs produits par git.
function gitDiff(a, b) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tcpr-"));
  fs.mkdirSync(path.join(dir, "a"));
  fs.mkdirSync(path.join(dir, "b"));
  fs.writeFileSync(path.join(dir, "a", "f.TcPOU"), a);
  fs.writeFileSync(path.join(dir, "b", "f.TcPOU"), b);
  try {
    return execFileSync("git", ["-c", "core.autocrlf=false", "diff", "--no-index", "--no-color", "a/f.TcPOU", "b/f.TcPOU"], { cwd: dir, encoding: "utf8" });
  } catch (e) {
    return e.stdout; // code 1 = différences trouvées
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("reverseApply : aller-retour sur diffs git (LF, CRLF, BOM, sans saut de ligne final)", () => {
  const a = read("FB_InputWithPropertiesAndMethods.TcPOU");
  const b = read("FB_ExpectedWithPropertiesAndMethods.TcPOU");
  const cases = [
    [a, b],
    [a.replace(/\n/g, "\r\n"), b.replace(/\n/g, "\r\n")],
    ["﻿" + a, "﻿" + b.replace("Counter", "Compteur")],
    [a.replace(/\n$/, ""), b + "\n"],
    [a + "\n", b.replace(/\n$/, "")],
    [a.replace(/\n/g, "\r\n").replace(/\r\n$/, ""), b.replace(/\n/g, "\r\n")],
  ];
  cases.forEach(([before, after], k) => {
    const files = G.parseUnifiedDiff(gitDiff(before, after));
    assert.strictEqual(files.length, 1, `cas ${k}`);
    assert.ok(files[0].newPath.endsWith("f.TcPOU"), files[0].newPath);
    assert.strictEqual(G.reverseApply(after, files[0].hunks), before, `cas ${k}`);
  });
});

test("reverseApply : diff incohérent détecté", () => {
  const a = read("PlcTask.TcTTO");
  const b = a.replace("10000", "1000");
  const files = G.parseUnifiedDiff(gitDiff(a, b));
  assert.throws(() => G.reverseApply(b.replace("MAIN", "MAIN2"), files[0].hunks), /ne correspond pas/);
});

test("parseUnifiedDiff : ajout, suppression, renommage", () => {
  const txt = [
    "diff --git a/x/New.TcDUT b/x/New.TcDUT",
    "new file mode 100644",
    "index 0000000..1111111",
    "--- /dev/null",
    "+++ b/x/New.TcDUT",
    "@@ -0,0 +1,2 @@",
    "+l1",
    "+l2",
    "diff --git a/x/Old.TcGVL b/x/Old.TcGVL",
    "deleted file mode 100644",
    "--- a/x/Old.TcGVL",
    "+++ /dev/null",
    "@@ -1 +0,0 @@",
    "-gone",
    "diff --git a/x/A.TcPOU b/x/B.TcPOU",
    "similarity index 100%",
    "rename from x/A.TcPOU",
    "rename to x/B.TcPOU",
    "",
  ].join("\n");
  const f = G.parseUnifiedDiff(txt);
  assert.deepStrictEqual(f.map((x) => [x.status, x.oldPath, x.newPath]), [
    ["added", "x/New.TcDUT", "x/New.TcDUT"],
    ["removed", "x/Old.TcGVL", "x/Old.TcGVL"],
    ["renamed", "x/A.TcPOU", "x/B.TcPOU"],
  ]);
  assert.strictEqual(f[0].hunks[0].lines.length, 2);
});

test("lignes : ST sans enveloppe, échafaudage, bruit LineIds et GUID", () => {
  const src = read("FB_InputWithPropertiesAndMethods.TcPOU").replace(
    "  </POU>",
    '    <LineIds Name="FB_Child">\n      <LineId Id="3" Count="0" />\n    </LineIds>\n  </POU>'
  );
  const r = L.classifyLines("a.TcPOU", src);
  const at = (n) => r.lines[n];
  assert.strictEqual(at(3).role, "scaffold");
  assert.deepStrictEqual(at(4), {
    role: "code",
    section: "POU:FB_Child#decl",
    label: "FUNCTION_BLOCK FB_Child · déclaration",
    code: "FUNCTION_BLOCK  FB_Child EXTENDS FB_Base  IMPLEMENTS I_Interface,I_Interface2",
    start: true,
  });
  assert.strictEqual(at(12).code, "END_VAR");
  assert.strictEqual(at(37).label, "Méthode AddTwoInts · implémentation");
  assert.strictEqual(at(56).role, "scaffold"); // « ]]></Declaration> » seul sur sa ligne
  assert.deepStrictEqual([92, 93, 94].map((n) => at(n).role), ["noise", "noise", "noise"]);
  const t = L.classifyLines("t.TcTTO", read("PlcTask.TcTTO"));
  assert.strictEqual(t.lines[5].role, "config");
  assert.strictEqual(t.lines[10].role, "noise");
  assert.strictEqual(
    L.noiseKey('<POU Name="A" Id="{16c60171-46ae-4c0f-982d-d26906c8a65a}">'),
    L.noiseKey('<POU Name="A" Id="{00000000-46ae-4c0f-982d-d26906c8a65a}">')
  );
});

console.log(`\n${passed} test(s) réussi(s)${process.exitCode ? ", avec des échecs" : ""}`);
