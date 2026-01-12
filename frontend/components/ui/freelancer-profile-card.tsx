"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Bookmark, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FreelancerProfileCardProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  title: string;
  avatarSrc: string;
  bannerSrc: string;
  rating: number;
  duration: string;
  rate: string;
  tools: React.ReactNode;
  onBookmark?: () => void;
  /** New prop to handle saving data to backend */
  onSave?: (data: { name: string; photo: string }) => Promise<void>;
  className?: string;
}

// Animation variants (same as your code)
const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  hover: { scale: 1.02, transition: { duration: 0.3 } },
};

export const FreelancerProfileCard = React.forwardRef<HTMLDivElement, FreelancerProfileCardProps>(
  ({ className, name, title, avatarSrc, bannerSrc, rating, duration, rate, tools, onBookmark, onSave, ...props }, ref) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editData, setEditData] = React.useState({ name, photo: avatarSrc });
    const [loading, setLoading] = React.useState(false);

    const handleSave = async () => {
      if (!onSave) return;
      setLoading(true);
      try {
        await onSave(editData);
        setIsEditing(false);
      } finally {
        setLoading(false);
      }
    };

    return (
      <motion.div
        ref={ref}
        className={cn("relative w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-lg border", className)}
        variants={cardVariants}
        initial="initial"
        animate="animate"
        whileHover="hover"
        {...props}
      >
        <div className="h-32 w-full">
          <img src={bannerSrc} alt="banner" className="h-full w-full object-cover" />
        </div>

        <Button
          variant="secondary"
          size="icon"
          className="absolute right-4 top-4 h-9 w-9 rounded-lg bg-background/50 backdrop-blur-sm"
          onClick={onBookmark}
        >
          <Bookmark className="h-4 w-4" />
        </Button>

        <div className="absolute left-1/2 top-32 -translate-x-1/2 -translate-y-1/2">
          <Avatar className="h-20 w-20 border-4 border-card shadow-md">
            <AvatarImage src={avatarSrc} alt={name} />
            <AvatarFallback>{name.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>

        <div className="px-6 pb-6 pt-12">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">{name}</h2>
              <p className="text-sm text-muted-foreground">{title}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex gap-1.5">{tools}</div>
              <span className="text-xs text-muted-foreground">Tools</span>
            </div>
          </div>

          <div className="my-6 flex items-center justify-around rounded-lg border bg-muted/30 p-4">
            <StatItem icon={Star} value={rating.toFixed(1)} label="rating" />
            <div className="h-8 w-px bg-border" />
            <StatItem value={duration} label="Account" />
            <div className="h-8 w-px bg-border" />
            <StatItem value={rate} label="Active" />
          </div>

          {/* EDIT DIALOG TRIGGER */}
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button className="w-full gap-2" size="lg" variant="default">
                <Pencil className="h-4 w-4" /> Edit Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="photo">Profile Photo URL</Label>
                  <Input
                    id="photo"
                    placeholder="https://..."
                    value={editData.photo}
                    onChange={(e) => setEditData({ ...editData, photo: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>
    );
  }
);

const StatItem = ({ icon: Icon, value, label }: { icon?: any; value: string | number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="flex items-center gap-1 font-bold">
      {value}
    </div>
    <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
  </div>
);