
<Spec>
<FormatRequirements>
1. **Output only `<wonder>` elements**—no XML declaration (`<?xml...?>`) and no extra root elements.
2. Each `<wonder>` must have exactly one `<file>` child element. 
3. Each `<file>` element **must** have a valid `p` attribute specifying a full file path (e.g., `/var/www/html/index.js`).
4. Enclose the **entire** file content inside `<![CDATA[ ... ]]>` blocks.
5. **No extra text** or comments outside `<file>...</file>`.
6. The final XML snippet **must be well-formed** so it can be wrapped by our app’s `<root>...</root>` without errors.
7. Use **full file paths** (e.g., `/var/www/html/good`). **No** relative paths like `./bad` or `../bad`.
8. Wrap all `<wonder>` elements together in a single Markdown code block with language identifier `xml`. 
9. After the Markdown block, include a brief summary (outside the block). If any additional packages or steps are required, list them there.
10. If you must delete a file, you may omit a `<![CDATA[ ]]>` block for that file (since it’s removed).
11. Follow the official operations below, strictly used as `operation="X"` on the `<wonder>` element:
    - `operation="replace"`: Replace the entire file contents
    - `operation="delete"`: Remove the file completely
    - `operation="create"`: Create a new file
12. Replace WorkingDir with what is defined in WorkingDir
</FormatRequirements>

<MISSION_CRITICAL_REQUIREMENTS>
    <COMPLETE_CODE_PER_FILE_NEVER_SKIP strict="true"/>
    <NEVER_SKIP_CODE_BLOCKS strict="true"/>
    <INCLUDE_ALL_DEPENDENCIES_AND_IMPORTS strict="true"/>
    <EACH_FILE_MUST_BE_COMPLETE strict="true"/>
    <TYPE_DEFINITIONS_FOR_TS_FILES_AND_OTHERS strict="true"/>
    <PERFECT_FORMATTED_CODE_AND_INDENTATION strict="true"/>
</MISSION_CRITICAL_REQUIREMENTS>

<PriorityImportantInfo>
_WE_DO_NOT_HAVE_PATCH_DIFF_OR_SEARCH_SUPPORT. ONLY REPLACE;DELETE OR CREATE
</PriorityImportantInfo>

<AdditionalInfo>
- Provide a `<d>` child element under `<wonder>` to describe **what** changed or why (in CDATA).
- Only include files that you actually modify (or create/delete). If a file is not touched, do not include it.
- Maintain all original functionality unless explicitly asked otherwise in `<Task/>`.
- When modifying TypeScript files, ensure all types remain valid.
- Never show placeholders (like “... partial code ...”)—always include the **complete** file if you replace or create it.
- If changes to package.json are needed, output it as a separate `<wonder operation="replace">` (or `create` if none existed) with `<file p="package.json">`. Provide the entire updated JSON inside `<![CDATA[ ... ]]>`.
- Keep your summary after the Markdown block succinct and focused on **what** changed.
</AdditionalInfo>

<EXAMPLE_FINAL_OUTPUT>

```xml
<wonder operation="replace">
  <d><![CDATA[Replaced file content with new feature X]]></d>
  <file p="$_ROOT/app.js">
    <![CDATA[
    console.log("New content goes here");
    ]]>
  </file>
</wonder>

<wonder operation="delete">
  <d><![CDATA[Removed outdated config]]></d>
  <file p="<WorkingDir>/oldConfig.json"/>
</wonder>

<wonder operation="create">
  <d><![CDATA[Created a new utility file]]></d>
  <file p="<WorkingDir>/utils/helper.ts">
    <![CDATA[
    export function helper() {
      return "I'm new!";
    }
    ]]>
  </file>
</wonder>

1.Each <wonder> has a single <file> child.
2.The operation attribute indicates how the file is handled.
3.A <d> element (with CDATA) describes what changed.
4.The file’s full content goes in <![CDATA[ ... ]]> if the operation is replace or create.
5.For deletions, we omit the <![CDATA[ ]]> block entirely.

</EXAMPLE_FINAL_OUTPUT>
</Spec>

Now, having read and fully understood the <Spec/>, follow:
<Instructions>
1.Read the source code and the <Task/> instructions.
2.Perform the requested changes to each file in full, or remove/create files as needed.
3.For each file changed, output a <wonder operation="..."> block with one <file> child, wrapping the entire file contents in <![CDATA[ ... ]]>.
4.Ensure your final output is a single (one) valid XML containing only <wonder> blocks, all wrapped in a single ```````xml code block (i.e., triple backticks + "xml").
</Instructions>