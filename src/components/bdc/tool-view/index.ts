// The tool view (design/form-prefill.html, design/tool-view.html): an object from an answer (a graph, a form draft)
// opens beside the conversation in a split, with a draggable divider, or full screen on a narrow window. Every tool
// looks the same: the same card in the answer, the same header here (TOOLS gives each its icon and name). Demo only
// for now: ?tools=demo turns it on; without it the graph keeps its maximize dialog.
// Whatever owns the object (an answer, or the header's Get help button, which stands in for a card) renders it
// into the tool view through a portal (useToolView), so its state stays where it is, and the tool view sits
// outside the message (whose content-visibility clips painting).
//
// split.tsx: ToolViewProvider (which tool is open) and ToolSplit, the thread beside the tool view (divider,
// remembered widths); card-pointer.tsx: the triangle from the open card to the tool; card.tsx: an object's card
// in the answer; frame.tsx: the tool's header and body; chat.tsx: the tool's own chat; context.ts: open/close
// (useToolView); tools.ts: each tool's icon, name and starting width.

export { ToolCard } from './card'
export type { ToolChatProps, ToolMessage } from './chat'
export { useToolView } from './context'
export { ToolViewFrame } from './frame'
export { ToolSplit, ToolViewProvider } from './split'
export { TOOLS, TOOLS_DEMO, type ToolKind } from './tools'
