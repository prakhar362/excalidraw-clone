import * as React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { UserPlusIcon, UsersIcon, PencilIcon,PencilRuler } from "lucide-react";

export function AppSidebar({
  onLogout,
  ...props
}: React.ComponentProps<typeof Sidebar> & { onLogout?: () => void }) {
  return (
    <Sidebar {...props}>
      {/* Header with Excalidraw branding */}
<SidebarHeader className="flex px-4 py-4 border-b border-gray-200">
  <div className="flex items-center gap-2">
    <PencilRuler className="w-5 h-5 text-gray-700" />
    <h1 className="text-2xl font-bold text-black tracking-tight">Sketchcalibur</h1>
  </div>
</SidebarHeader>
      {/* Sidebar content */}
      <SidebarContent className="overflow-y-auto">
        {/* Dummy Group 1 */}
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#">Color Picker</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#">Layer Manager</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dummy Group 2 */}
        <SidebarGroup>
          <SidebarGroupLabel>Features</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#">Live Cursors</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#">Auto Sync</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#">Export to PDF</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dummy Group 3 */}
        <SidebarGroup>
          <SidebarGroupLabel>Coming Soon</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#">AI Suggestions</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#">Voice Notes</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#">3D Mode</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Logout at the bottom */}
      <div className="p-4 mt-auto border-t border-gray-200">
        <button
          onClick={onLogout}
          className="w-full bg-white hover:bg-red-700 hover:text-white text-red-700 font-semibold py-2 px-4 rounded-lg shadow transition-all duration-200"
        >
          Logout
        </button>
      </div>

      <SidebarRail />
    </Sidebar>
  )
}
