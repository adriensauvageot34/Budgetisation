import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const repositoryRoot = process.cwd();
const sourceRoot = path.join(repositoryRoot, "src");

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function relativeSourcePath(filePath) {
  return toPosix(path.relative(repositoryRoot, filePath));
}

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

function sourceMetadata(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports = [];

  function recordModuleSpecifier(node, moduleSpecifier) {
    if (!moduleSpecifier || !ts.isStringLiteralLike(moduleSpecifier)) return;
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    imports.push({
      specifier: moduleSpecifier.text,
      line: position.line + 1,
    });
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      recordModuleSpecifier(node, node.moduleSpecifier);
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      recordModuleSpecifier(node, node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const firstStatement = sourceFile.statements[0];
  const isClient = Boolean(
    firstStatement &&
      ts.isExpressionStatement(firstStatement) &&
      ts.isStringLiteral(firstStatement.expression) &&
      firstStatement.expression.text === "use client",
  );

  return { imports, isClient, text };
}

function resolveInternalTarget(sourcePath, specifier) {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (!specifier.startsWith(".")) return null;
  const absoluteSource = path.join(repositoryRoot, sourcePath);
  return toPosix(
    path.relative(
      repositoryRoot,
      path.resolve(path.dirname(absoluteSource), specifier),
    ),
  );
}

function isWithin(target, prefix) {
  return target === prefix || target.startsWith(`${prefix}/`);
}

function featureName(sourcePath) {
  const match = /^src\/features\/([^/]+)/.exec(sourcePath);
  return match?.[1] ?? null;
}

function classifyImportViolation(sourcePath, specifier, isClient) {
  const target = resolveInternalTarget(sourcePath, specifier);
  const inCore = isWithin(sourcePath, "src/core");
  const inAnalytics = isWithin(sourcePath, "src/analytics");
  const inQueryApi = isWithin(sourcePath, "src/query-api");
  const inQueryApiServer = isWithin(sourcePath, "src/query-api/server");
  const inServer = isWithin(sourcePath, "src/server");
  const inUi = isWithin(sourcePath, "src/ui");
  const inUiFoundations = isWithin(sourcePath, "src/ui/foundations");
  const inUiPrimitives = isWithin(sourcePath, "src/ui/primitives");
  const inUiComposites = isWithin(sourcePath, "src/ui/composites");
  const inUiCharts = isWithin(sourcePath, "src/ui/charts");
  const inNavigation = isWithin(sourcePath, "src/navigation");
  const sourceFeature = featureName(sourcePath);
  const inSharedUi = isWithin(sourcePath, "src/shared/ui");

  if (inCore) {
    if (
      specifier === "react" ||
      specifier.startsWith("react/") ||
      specifier === "next" ||
      specifier.startsWith("next/") ||
      specifier === "server-only" ||
      specifier.startsWith("@supabase/")
    ) {
      return "core ne peut pas importer React, Next, server-only ou Supabase";
    }
    if (
      target &&
      [
        "src/server",
        "src/features",
        "src/shared/ui",
        "src/ui",
        "src/components",
        "src/lib/supabase",
      ].some((prefix) => isWithin(target, prefix))
    ) {
      return "core ne peut pas importer server, features, UI ou Supabase";
    }
  }

  if (inAnalytics) {
    if (
      specifier === "react" ||
      specifier.startsWith("react/") ||
      specifier === "next/navigation"
    ) {
      return "analytics ne peut pas importer React ou la navigation client";
    }
    if (
      target &&
      [
        "src/app",
        "src/features",
        "src/shared/ui",
        "src/ui",
        "src/components",
        "src/navigation",
      ].some((prefix) => isWithin(target, prefix))
    ) {
      return "analytics ne peut pas importer UI, pages ou Navigation";
    }
    if (target && isWithin(target, "src/query-api")) {
      return "analytics ne peut pas dépendre de Query API";
    }
  }

  if (inQueryApi) {
    if (
      specifier === "react" ||
      specifier.startsWith("react/") ||
      specifier === "next" ||
      specifier.startsWith("next/")
    ) {
      return "Query API ne peut pas importer React ou Next";
    }
    if (
      target &&
      [
        "src/app",
        "src/features",
        "src/shared/ui",
        "src/ui",
        "src/components",
        "src/navigation",
      ].some((prefix) => isWithin(target, prefix))
    ) {
      return "Query API ne peut pas importer UI, pages ou Navigation";
    }
  }

  if (inUi) {
    if (
      specifier === "server-only" ||
      specifier.startsWith("@supabase/")
    ) {
      return "UI Foundations ne peut pas importer server-only ou Supabase";
    }
    if (
      target &&
      [
        "src/analytics",
        "src/server",
        "src/query-api/server",
        "src/lib/supabase",
        "src/app",
        "src/features",
        "src/components",
      ].some((prefix) => isWithin(target, prefix))
    ) {
      return "UI Foundations ne peut pas importer Analytics, server, pages, features ou Supabase";
    }
  }

  if (inUiFoundations && target) {
    if (
      isWithin(target, "src/query-api") ||
      isWithin(target, "src/navigation") ||
      [
        "src/ui/primitives",
        "src/ui/composites",
        "src/ui/charts",
        "src/ui/metrics",
        "src/ui/media",
        "src/ui/feedback",
      ].some((prefix) => isWithin(target, prefix))
    ) {
      return "UI Foundations/tokens ne peut pas dépendre de Query, Navigation ou d’une couche UI supérieure";
    }
  }

  if (
    inUiPrimitives &&
    target &&
    ["src/ui/composites", "src/ui/charts"].some((prefix) =>
      isWithin(target, prefix),
    )
  ) {
    return "UI Primitives ne peut pas dépendre des Composites ou Charts";
  }

  if (
    inUiComposites &&
    target &&
    (isWithin(target, "src/ui/charts") ||
      (isWithin(target, "src/navigation") && target !== "src/navigation"))
  ) {
    return "UI Composites ne peut pas dépendre des Charts ou des internals Navigation";
  }

  if (
    inUiCharts &&
    target &&
    isWithin(target, "src/navigation") &&
    target !== "src/navigation"
  ) {
    return "UI Charts ne peut importer que les types publics Navigation";
  }

  if (inNavigation && target && isWithin(target, "src/ui")) {
    return "Navigation ne peut pas persister ou importer des DTO UI/media";
  }

  if (sourceFeature || isClient) {
    if (
      target &&
      [
        "src/server",
        "src/lib/supabase/server",
        "src/lib/supabase/proxy",
      ].some((prefix) => isWithin(target, prefix))
    ) {
      return "une feature ou un module client ne peut pas importer server";
    }
  }

  if (
    target &&
    isWithin(target, "src/query-api/server") &&
    !inQueryApiServer &&
    !inServer
  ) {
    return "query-api/server ne peut être importé que depuis une frontière serveur";
  }

  if (inServer) {
    if (
      target &&
      ["src/features", "src/shared/ui", "src/components"].some((prefix) =>
        isWithin(target, prefix),
      )
    ) {
      return "server ne peut pas importer features ou UI";
    }
    if (
      specifier === "react" ||
      specifier.startsWith("react/") ||
      specifier === "next/navigation"
    ) {
      return "server ne peut pas importer React ou des hooks de navigation client";
    }
  }

  if (inSharedUi) {
    if (
      target &&
      [
        "src/server",
        "src/features",
        "src/core/analytics",
        "src/lib/supabase/server",
      ].some((prefix) => isWithin(target, prefix))
    ) {
      return "UI partagée ne peut pas importer server, features ou Analytics";
    }
  }

  const targetFeature = target ? featureName(target) : null;
  if (sourceFeature && targetFeature && sourceFeature !== targetFeature) {
    return "une feature ne peut pas importer les internals d’une autre feature";
  }

  return null;
}

function requiresServerOnlyMarker(sourcePath) {
  if (
    sourcePath === "src/lib/supabase/server.ts" ||
    sourcePath === "src/lib/supabase/proxy.ts"
  ) {
    return true;
  }
  if (
    !isWithin(sourcePath, "src/server") &&
    !isWithin(sourcePath, "src/query-api/server")
  ) return false;
  return !/(?:^|\/)(?:types|errors)\.ts$/.test(sourcePath);
}

function selfCheckRules() {
  const cases = [
    ["src/core/example.ts", "react", false],
    ["src/core/example.ts", "@/server/example", false],
    ["src/core/example.ts", "@supabase/supabase-js", false],
    ["src/analytics/example.ts", "@/navigation", false],
    ["src/analytics/example.ts", "react", false],
    ["src/analytics/example.ts", "@/query-api", false],
    ["src/query-api/example.ts", "react", false],
    ["src/query-api/example.ts", "@/components/example", false],
    ["src/ui/example.tsx", "@/analytics/production", true],
    ["src/ui/example.tsx", "@/query-api/server", true],
    ["src/ui/example.tsx", "@supabase/supabase-js", true],
    ["src/core/example.ts", "@/ui", false],
    ["src/query-api/example.ts", "@/ui", false],
    ["src/navigation/example.ts", "@/ui/media", false],
    ["src/ui/foundations/example.ts", "@/query-api", false],
    ["src/ui/foundations/example.ts", "@/ui/primitives", false],
    ["src/ui/primitives/example.tsx", "@/ui/composites", true],
    ["src/ui/composites/example.tsx", "@/ui/charts", true],
    ["src/ui/charts/example.tsx", "@/navigation/contracts/exploration", true],
    ["src/features/example/client.ts", "@/query-api/server", true],
    ["src/features/example/client.ts", "@/server/example", true],
    ["src/server/example.ts", "@/features/example/client", false],
  ];
  for (const [sourcePath, specifier, isClient] of cases) {
    if (!classifyImportViolation(sourcePath, specifier, isClient)) {
      throw new Error(`Architecture self-check incomplet: ${sourcePath} → ${specifier}`);
    }
  }
}

selfCheckRules();

const violations = [];
const sourceFiles = collectSourceFiles(sourceRoot);
for (const filePath of sourceFiles) {
  const sourcePath = relativeSourcePath(filePath);
  const metadata = sourceMetadata(filePath);

  for (const imported of metadata.imports) {
    const reason = classifyImportViolation(
      sourcePath,
      imported.specifier,
      metadata.isClient,
    );
    if (reason) {
      violations.push(
        `${sourcePath}:${imported.line} ${reason}: ${imported.specifier}`,
      );
    }
  }

  if (
    requiresServerOnlyMarker(sourcePath) &&
    !metadata.imports.some(({ specifier }) => specifier === "server-only")
  ) {
    violations.push(`${sourcePath}:1 module serveur sensible sans marqueur server-only`);
  }

  if (
    (metadata.isClient || featureName(sourcePath) || isWithin(sourcePath, "src/ui")) &&
    /process\.env\.(?!NEXT_PUBLIC_)[A-Z0-9_]+/.test(metadata.text)
  ) {
    violations.push(`${sourcePath}:1 variable serveur utilisée dans du code client/feature`);
  }

  if (
    (isWithin(sourcePath, "src/analytics") ||
      isWithin(sourcePath, "src/query-api")) &&
    /\b(?:globalThis\.(?:window|document|navigator|localStorage|sessionStorage)|window\.(?:location|history|document|navigator|localStorage|sessionStorage)|document\.(?:cookie|body|querySelector|getElementById)|navigator\.(?:userAgent|language)|(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem|clear))/.test(metadata.text)
  ) {
    violations.push(`${sourcePath}:1 Analytics/Query API utilise une API navigateur`);
  }
}

if (violations.length > 0) {
  console.error("Architecture import check: FAIL");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Architecture import check: PASS (${sourceFiles.length} fichiers)`);
}
