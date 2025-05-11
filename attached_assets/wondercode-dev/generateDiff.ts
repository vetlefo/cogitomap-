import { diffLines, parsePatch, applyPatch } from "diff";

/**
 * Represents the shape of a single file's diff result
 */
export interface DiffResult {
  filePath: string;
  operation: string;
  description?: string; // now we'll store the parent <wonder> <d> text here
  diffText: string;
}

/**
 * Parses the XML, compares new content (or patch) vs existing content, and returns
 * an array of diffs. Crucially, now we read the parent <wonder> tag's <d> description
 * and apply it to each file under that <wonder>.
 *
 * @param {string} xmlInput - The XML snippet containing one or more <wonder> blocks
 * with <d> for description and one or more <file> elements.
 * @returns {Promise<DiffResult[]>} - An array of diffs describing each file's planned change.
 */
export async function generateDiffFromXml(
  xmlInput: string,
): Promise<DiffResult[]> {
  const diffResults: DiffResult[] = [];

  // Wrap in <root> if needed
  const wrapped = xmlInput.trim().startsWith("<root>")
    ? xmlInput.trim()
    : `<root>${xmlInput}</root>`;

  // Parse
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(wrapped, "text/xml");

  // Check for errors
  const parserErrors = xmlDoc.getElementsByTagName("parsererror");
  if (parserErrors.length > 0) {
    throw new Error(`XML parsing error: ${parserErrors[0].textContent}`);
  }

  // Find all <wonder> blocks
  const wonderElems = xmlDoc.getElementsByTagName("wonder");
  if (!wonderElems || wonderElems.length === 0) {
    throw new Error("No <wonder> elements found in XML");
  }

  // For each <wonder> block, extract the parent operation and description, then process the <file> children
  for (let w = 0; w < wonderElems.length; w++) {
    const wonderElem = wonderElems[w];

    // Parent-level operation
    const parentOp = (
      wonderElem.getAttribute("operation") || "replace"
    ).toLowerCase();

    // Parent-level <d> (description)
    let parentDesc = "";
    const dElem = wonderElem.getElementsByTagName("d")[0];
    if (dElem) {
      // Check for CDATA
      const child = dElem.firstChild;
      if (child && child.nodeType === Node.CDATA_SECTION_NODE) {
        parentDesc = child.nodeValue?.trim() || "";
      } else {
        parentDesc = dElem.textContent?.trim() || "";
      }
    }

    // Grab all <file> children under this <wonder>
    const fileElems = wonderElem.getElementsByTagName("file");
    if (!fileElems || fileElems.length === 0) {
      // It's possible <wonder> has no <file>, e.g., a delete with no child content
      continue;
    }

    // For each file
    for (let i = 0; i < fileElems.length; i++) {
      const f = fileElems[i];
      const filePath = f.getAttribute("p") || "";
      if (!filePath) {
        // skip if no path
        continue;
      }

      // The file-level operation can override the parent's operation if present
      const opAttr = f.getAttribute("operation");
      const operation = opAttr ? opAttr.toLowerCase() : parentOp;

      // We'll attach the parent's <d> text to all files in that wonder
      const description = parentDesc;

      // If "delete" => short-circuit
      if (operation === "delete") {
        diffResults.push({
          filePath,
          operation: "delete",
          description,
          diffText: "File will be deleted",
        });
        continue;
      }

      // If "create"
      if (operation === "create") {
        const newRaw = f.textContent || "";
        const newContent = newRaw.replace(/^\s+/, "").replace(/\s+$/, "");
        try {
          // Check if file exists
          const oldContent = await window.electronAPI.readFile(filePath);
          // Generate a line-based diff from old => new
          const diff = diffLines(
            oldContent.replace(/^\s+/, "").replace(/\s+$/, ""),
            newContent,
            { newlineIsToken: true },
          );
          let diffText = "";
          diff.forEach((part) => {
            const symbol = part.added ? "+" : part.removed ? "-" : " ";
            part.value.split("\n").forEach((line) => {
              if (line === "" && (symbol === "+" || symbol === "-")) {
                diffText += symbol + "\n";
              } else if (line !== "") {
                diffText += symbol + " " + line + "\n";
              }
            });
          });
          diffResults.push({
            filePath,
            operation: "create",
            description,
            diffText,
          });
        } catch (err: any) {
          // Probably file does not exist
          let message = "File does not exist. Will be created.";
          if (err instanceof Error && err.message.includes("ENOENT")) {
            message = "File does not exist. Will be created.";
          }
          diffResults.push({
            filePath,
            operation: "create",
            description,
            diffText: message,
          });
        }
        continue;
      }

      // If "patch"
      if (operation === "patch") {
        try {
          const oldContent = await window.electronAPI.readFile(filePath);
          const patchText = f.textContent || "";
          // Parse unified diff from XML
          const patches = parsePatch(patchText);

          // Find relevant patch for this file
          const relevantPatch = patches.find(
            (p) =>
              (p.oldFileName && p.oldFileName.endsWith(filePath)) ||
              (p.newFileName && p.newFileName.endsWith(filePath)),
          );
          if (!relevantPatch) {
            diffResults.push({
              filePath,
              operation: "patch",
              description,
              diffText: "No matching patch data for this file",
            });
            continue;
          }

          // Try applying patch in memory
          const newContent = applyPatch(oldContent, relevantPatch);
          if (newContent === false) {
            diffResults.push({
              filePath,
              operation: "patch",
              description,
              diffText: "Unable to apply patch (applyPatch returned false)",
            });
            continue;
          }

          // Now generate a standard line diff from old => new
          const diff = diffLines(oldContent, newContent, {
            newlineIsToken: true,
          });
          let diffText = "";
          diff.forEach((part) => {
            const symbol = part.added ? "+" : part.removed ? "-" : " ";
            part.value.split("\n").forEach((line) => {
              if (line === "" && (symbol === "+" || symbol === "-")) {
                diffText += symbol + "\n";
              } else if (line !== "") {
                diffText += symbol + " " + line + "\n";
              }
            });
          });

          diffResults.push({
            filePath,
            operation: "patch",
            description,
            diffText,
          });
        } catch (err: any) {
          diffResults.push({
            filePath,
            operation: "patch",
            description,
            diffText: `Patch error: ${err?.message ?? String(err)}`,
          });
        }
        continue;
      }

      // Otherwise, treat as "replace"
      if (operation === "replace") {
        try {
          const oldContent = await window.electronAPI.readFile(filePath);
          const newRaw = f.textContent || "";
          const newContent = newRaw.replace(/^\s+/, "").replace(/\s+$/, "");
          const diff = diffLines(
            oldContent.replace(/^\s+/, "").replace(/\s+$/, ""),
            newContent,
            { newlineIsToken: true },
          );

          let diffText = "";
          diff.forEach((part) => {
            const symbol = part.added ? "+" : part.removed ? "-" : " ";
            part.value.split("\n").forEach((line) => {
              if (line === "" && (symbol === "+" || symbol === "-")) {
                diffText += symbol + "\n";
              } else if (line !== "") {
                diffText += symbol + " " + line + "\n";
              }
            });
          });

          diffResults.push({
            filePath,
            operation: "replace",
            description,
            diffText,
          });
        } catch (err: any) {
          let message = `Unable to generate diff (read error): ${
            err?.message || err
          }`;
          if (err instanceof Error && err.message.includes("ENOENT")) {
            message = "File does not exist. Will be created.";
          }
          diffResults.push({
            filePath,
            operation: "replace",
            description,
            diffText: message,
          });
        }
        continue;
      }

      // Otherwise, unrecognized operation
      diffResults.push({
        filePath,
        operation,
        description,
        diffText: `Unsupported operation: ${operation}`,
      });
    }
  }

  return diffResults;
}
