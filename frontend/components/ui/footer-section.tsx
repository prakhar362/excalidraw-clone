"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Facebook, Github, Instagram, Linkedin, Moon, Send, Sun, Twitter } from "lucide-react"

function Footerdemo() {
  const [isDarkMode, setIsDarkMode] = React.useState(true)
  const [isChatOpen, setIsChatOpen] = React.useState(false)

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  return (
    <footer className="relative border-t bg-background text-foreground transition-colors duration-300">
      <div  id="about" className="container mx-auto px-4 py-12 md:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">Stay Connected</h2>
            <p className="mb-6 text-muted-foreground">
              Collaborate with me on exciting projects!
            </p>
            <form className="relative">
              <Input
                type="email"
                placeholder="Enter your email"
                className="pr-12 backdrop-blur-sm"
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8 rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Subscribe</span>
              </Button>
            </form>
            <div className="absolute -right-4 top-0 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Quick Links</h3>
            <nav className="space-y-2 text-sm">
              <a href="#features" className="block transition-colors hover:text-primary">
                Home
              </a>
              <a href="#features" className="block transition-colors hover:text-primary">
                Features
              </a>
              <a href="#discover" className="block transition-colors hover:text-primary">
                Discover
              </a>
              <a href="#testimonials" className="block transition-colors hover:text-primary">
                Testimonials
              </a>
              <a href="#about" className="block transition-colors hover:text-primary">
                Contact
              </a>
            </nav>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Contact Me</h3>
            <address className="space-y-2 text-sm not-italic">
              <p>Mumbai, India</p>
              <p>Portfolio: <a href="https://prakhar-shrivastava.vercel.app/">prakhar-shrivastava.vercel.app</a></p>
              <p>Email: prakharshri2005@gmail.com</p>
            </address>
          </div>
          <div className="relative">
            <h3 className="mb-4 text-lg font-semibold">Follow Me</h3>
            <div className="mb-6 flex space-x-4">
  {/* GitHub */}
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="https://github.com/prakhar362"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="icon" className="rounded-full">
            <Github className="h-4 w-4" />
            <span className="sr-only">GitHub</span>
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>View my GitHub</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>

  {/* Twitter / X */}
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="https://twitter.com/prakharshri2005"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="icon" className="rounded-full">
            <Twitter className="h-4 w-4" />
            <span className="sr-only">Twitter</span>
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>Follow me on Twitter</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>

  {/* Instagram */}
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="https://www.instagram.com/prakhar_shri15/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="icon" className="rounded-full">
            <Instagram className="h-4 w-4" />
            <span className="sr-only">Instagram</span>
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>Follow me on Instagram</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>

  {/* LinkedIn */}
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="https://www.linkedin.com/in/prakhar-shrivastava-a4927b2b5/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="icon" className="rounded-full">
            <Linkedin className="h-4 w-4" />
            <span className="sr-only">LinkedIn</span>
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>Connect with me on LinkedIn</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>

            <div className="flex items-center space-x-2">
              <Sun className="h-4 w-4" />
              <Switch
                id="dark-mode"
                checked={isDarkMode}
                onCheckedChange={setIsDarkMode}
              />
              <Moon className="h-4 w-4" />
              <Label htmlFor="dark-mode" className="sr-only">
                Toggle dark mode
              </Label>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 text-center md:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2026 By Prakhar Shrivastava. All rights reserved.
          </p>
          <nav className="flex gap-4 text-sm">
            <a href="#" className="transition-colors hover:text-primary">
              Privacy Policy
            </a>
            <a href="#" className="transition-colors hover:text-primary">
              Terms of Service
            </a>
            <a href="#" className="transition-colors hover:text-primary">
              Cookie Settings
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export { Footerdemo }