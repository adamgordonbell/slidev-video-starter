// Hands Slidev's navigation to the page, so tools/record-deck.mjs can jump to any slide and click.
import { defineRootSetup } from "@slidev/types";
import { useNav } from "@slidev/client";

export default defineRootSetup(() => {
  (window as unknown as { __nav: unknown }).__nav = useNav();
});
