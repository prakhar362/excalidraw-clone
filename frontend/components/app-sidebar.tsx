"use client";
import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar"; // Adjust path to your UI folder
import {
  IconArrowLeft,
  IconBrandTabler,
  IconSettings,
  IconUserBolt,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { PencilRuler } from "lucide-react";

export function AppSidebar({ onLogout }: { onLogout: () => void }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const links = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: (
        <IconBrandTabler className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Profile",
      href: "#",
      icon: (
        <IconUserBolt className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Settings",
      href: "#",
      icon: (
        <IconSettings className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    // Theme Toggle Link
    {
      label: theme === "dark" ? "Light Mode" : "Dark Mode",
      href: "#",
      onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
      icon: theme === "dark" ? (
        <IconSun className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ) : (
        <IconMoon className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Logout",
      href: "#",
      onClick: onLogout,
      icon: (
        <IconArrowLeft className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
  ];

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
          {open ? <Logo /> : <PencilRuler className="w-5 h-5 text-black dark:text-amber-50" /> }
          <div className="mt-8 flex flex-col gap-2">
            {links.map((link, idx) => (
              <SidebarLink 
                key={idx} 
                link={link} 
                className="cursor-pointer"
                // Adding custom onClick handler support if your SidebarLink supports it
                // If not, we wrap it or handle it inside the SidebarLink component
                onClick={link.onClick} 
              />
            ))}
          </div>
        </div>
        <div>
          <SidebarLink
            link={{
              label: "User Profile",
              href: "#",
              icon: (
                <img
                  src="https://assets.aceternity.com/manu.png"
                  className="h-7 w-7 shrink-0 rounded-full"
                  alt="Avatar"
                />
              ),
            }}
          />
        </div>
      </SidebarBody>
    </Sidebar>
  );
}

const Logo = () => (
  <a href="#" className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black dark:text-white">
    
    <PencilRuler className="w-5 h-5 text-black dark:text-amber-50" /> 
    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-medium whitespace-pre text-2xl ">
      SketchCalibur
    </motion.span>
  </a>
);

