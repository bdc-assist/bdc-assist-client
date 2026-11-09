// bdc-assist local edits (redo after re-pulling): the header shows the app's favicon and
// names BDC Assist instead of linking to assistant-ui, and the footer has Delete all conversations
// and a "saved in this browser only" note instead of a GitHub link (its icon file is gone).
// On desktop the sidebar starts below the app header (top-10 / height className on <Sidebar>).
import type * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ThreadList } from "@/components/assistant-ui/elements/thread-list.aui";
import { DeleteAllConversations } from "@/components/bdc/delete-all-conversations";

export function ThreadListSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    // desktop: starts below the app header (h-10) instead of at the top of the window
    <Sidebar className="top-10 h-[calc(100svh-(--spacing(10)))]" {...props}>
      <SidebarHeader className="aui-sidebar-header mb-2 border-b">
        <div className="aui-sidebar-header-content flex items-center justify-between">
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2 p-2">
              <img
                src="/favicon.svg"
                alt=""
                className="aui-sidebar-header-icon size-7"
              />
              <span className="aui-sidebar-header-title font-semibold">
                BDC Assist
              </span>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarHeader>
      <SidebarContent className="aui-sidebar-content px-2">
        <ThreadList />
      </SidebarContent>
      {props.collapsible !== "none" && <SidebarRail />}
      <SidebarFooter className="aui-sidebar-footer border-t">
        <DeleteAllConversations />
        <p className="text-muted-foreground px-2 text-xs">
          Conversations saved only in browser
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
