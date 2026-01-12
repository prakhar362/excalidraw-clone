"use client";
import React, { useState, useEffect } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
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
import { PencilRuler, User as UserIcon } from "lucide-react";
import { Skeleton } from "./ui/skeleton";

interface AppSidebarProps {
  onLogout: () => void;
  user: {
    name: string;
    photo?: string;
  } | null;
}

export function AppSidebar({ onLogout, user }: AppSidebarProps) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true);
  }, []);

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
    {
      label: theme === "dark" ? "Light Mode" : "Dark Mode",
      href: "#",
      onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
      icon: mounted ? (
        theme === "dark" ? (
          <IconSun className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
        ) : (
          <IconMoon className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
        )
      ) : (
        <div className="h-5 w-5 shrink-0" /> // Placeholder during hydration
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
          {open ? (
            <Logo />
          ) : (
            <PencilRuler className="w-5 h-5 text-black dark:text-amber-50" />
          )}
          <div className="mt-8 flex flex-col gap-2">
            {links.map((link, idx) => (
              <SidebarLink
                key={idx}
                link={link}
                className="cursor-pointer"
                onClick={link.onClick}
              />
            ))}
          </div>
        </div>
        <div>
          <SidebarLink
    link={{
      label: user ? user.name : "Loading...",
      href: "#",
      icon: user ? (
        user.photo ? (
          <img src={user.photo} className="h-7 w-7 rounded-full object-cover" alt="Avatar" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )
      ) : (
        <Skeleton className="h-7 w-7 rounded-full" />
      ),
    }}
  />
        </div>
      </SidebarBody>
    </Sidebar>
  );
}

const Logo = () => (
  <a
    href="#"
    className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black dark:text-white"
  >
    <PencilRuler className="w-5 h-5 text-black dark:text-amber-50" />
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="font-medium whitespace-pre text-2xl"
    >
      SketchCalibur
    </motion.span>
  </a>
);