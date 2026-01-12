"use client";

import React, { useEffect, useState, Suspense, useMemo } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { FreelancerProfileCard } from "@/components/ui/freelancer-profile-card";
import { LayoutTemplate, Palette, Calendar, DoorOpen, Mail } from "lucide-react";
import { BACKEND_URL } from "../../config";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "react-toastify";

// Helper component for tool icons
const ToolIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
    <Icon className="h-4 w-4" />
  </div>
);

function ProfileContent() {
  const router = useRouter();
  const [userData, setUserData] = useState<{
    name: string;
    email: string;
    photo?: string;
    createdAt: string;
  } | null>(null);
  const [roomCount, setRoomCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth");
      return;
    }
    
    // Fetch both Profile and Rooms to get the count
    const initProfile = async () => {
      setLoading(true);
      await Promise.all([
        fetchUserProfile(token),
        fetchRoomCount(token)
      ]);
      setLoading(false);
    };

    initProfile();
  }, []);

  const fetchUserProfile = async (token: string) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/me`, {
        headers: { Authorization: token },
      });
      if (res.data.user) {
        setUserData(res.data.user);
      }
      //console.log("res.data.user: ",res.data);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        logout();
      }
    }
  };

  const fetchRoomCount = async (token: string) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/my-rooms`, {
        headers: { Authorization: token },
      });
      setRoomCount(res.data.rooms?.length || 0);
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    }
  };

  const handleUpdateProfile = async (newData: { name: string; photo: string }) => {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const res = await axios.post(
      `${BACKEND_URL}/me`,
      {
        name: newData.name,
        photo: newData.photo,
      },
      {
        headers: { Authorization: token },
      }
    );

    if (res.status === 200) {
      toast.success("Profile updated successfully!");
      // Refresh local state so sidebar and card update immediately
      setUserData((prev) => prev ? { ...prev, name: newData.name, photo: newData.photo } : null);
    }
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to update profile");
  }
};

  const logout = () => {
    localStorage.removeItem('token');
    router.push("/auth");
  };

  // Format the date (e.g., July 2025)
  // Format the date inside useMemo
  const joinDate = useMemo(() => {
    console.log("userData.createdAt: ",userData?.createdAt);
    if (!userData?.createdAt) return "";
    const date = new Date(userData.createdAt);
    console.log("date: ",date);
    const newDate= date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
    //console.log("newDate: ",newDate);
    setMounted(true);
    return newDate;
  }, [userData?.createdAt]);

  const tools = [
    <ToolIcon key="tool-1" icon={LayoutTemplate} />,
    <ToolIcon key="tool-2" icon={Palette} />,
  ];

  return (
    <div className="mx-auto flex w-full flex-1 flex-col overflow-hidden border border-neutral-200 bg-gray-50 md:flex-row dark:border-neutral-700 dark:bg-neutral-900 h-screen">
      <AppSidebar onLogout={logout} user={userData} />

      <div className="flex flex-1 flex-col overflow-y-auto bg-white dark:bg-neutral-900">
        <div className="flex h-full w-full items-center justify-center p-6 md:p-10">
          {loading ? (
            <div className="flex flex-col items-center gap-4 w-full max-w-md">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-8 w-1/2" />
            </div>
          ) : (
            <FreelancerProfileCard
              name={userData?.name || "User"}
              title={userData?.email || "SketchCalibur User"}
              avatarSrc={
                userData?.photo ||
                `https://ui-avatars.com/api/?name=${userData?.name}&background=random&color=fff`
              }
              // Professional banner
              bannerSrc="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
              rating={5.0}
              // We use "duration" field to show Account Age/Join Date
              duration={mounted ? `${joinDate}` : "Joined ..."}
              rate={`${roomCount} Rooms`}
              tools={tools}
              onSave={handleUpdateProfile} // <--- Add this
              onBookmark={() => toast.info("Profile bookmarked!")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-neutral-950 text-white">Loading...</div>}>
      <ProfileContent />
    </Suspense>
  );
}