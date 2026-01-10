'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-toastify';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { UserPlusIcon, PencilIcon } from "lucide-react";
import { BACKEND_URL } from '../../config';
import { Skeleton } from '@/components/ui/skeleton';

interface Room {
  _id: string;
  slug: string;
  createdAt: string;
  adminId: string;
}

// 1. Create a "Content" component for the logic
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  
  const [token, setToken] = useState<string | null>(null);
  const [roomSlug, setRoomSlug] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [collabUsername, setCollabUsername] = useState('');
  const [collabUseremail, setCollabUseremail] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadingCanvasId, setLoadingCanvasId] = useState<string | null>(null);
  const [canvasError, setCanvasError] = useState<string | null>(null);

  const toastOptions = {
    position: 'top-right' as const,
    autoClose: 2000,
    theme: 'dark' as const,
  };

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      setToken(urlToken);
      router.replace('/dashboard'); 
      toast.success("Logged in with Google!", toastOptions);
    } else {
      const savedToken = localStorage.getItem('token');
      if (savedToken) setToken(savedToken);
    }
  }, [searchParams]);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken && !searchParams.get('token')) {
      router.push('/auth');
      return;
    }

    if (storedToken) {
        fetchRooms(storedToken);
        const interval = setInterval(() => fetchRooms(storedToken), 5000);
        return () => clearInterval(interval);
    }
  }, [token]);
  
  const fetchRooms = async (activeToken?: string) => {
    const requestToken = activeToken || token || localStorage.getItem('token');
    if (!requestToken) return;

    try {
      const res = await axios.get(`${BACKEND_URL}/my-rooms`, {
        headers: { Authorization: requestToken },
      });
      setRooms(res.data.rooms);
    } catch (err) {
      console.error("Fetch rooms failed", err);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName || !token) return;
    setCreating(true);
    try {
      await axios.post(
        `${BACKEND_URL}/create-room`,
        { name: newRoomName },
        { headers: { Authorization: token } }
      );
      toast.success('Room created!', toastOptions);
      setNewRoomName('');
      setShowCreateDialog(false);
      fetchRooms(token);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error creating room', toastOptions);
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async () => {
    if (!roomSlug) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/room/${roomSlug}`);
      const { room } = res.data;
      if (room && room._id) {
        router.push(`/canvas/${room._id}`);
      } else {
        toast.error("Room not found", toastOptions);
      }
    } catch (e) {
      toast.error("Room not found", toastOptions);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    router.push('/auth');
  };

  const addCollaborator = async () => {
    if (!collabUsername || !collabUseremail || !selectedRoom || !token) return;
    try {
      const res = await axios.post(
        `${BACKEND_URL}/rooms/${selectedRoom._id}/add-collaborator`,
        { username: collabUsername, useremail: collabUseremail },
        { headers: { Authorization: token } }
      );
      toast.success(res.data.message || 'Collaborator added!', toastOptions);
      setCollabUsername('');
      setCollabUseremail('');
      setSelectedRoom(null);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      toast.error(msg || 'No such user', toastOptions);
    }
  };

  const getUserIdFromToken = () => {
    if (!token) return null;
    try {
        return JSON.parse(atob(token.split(".")[1])).userId;
    } catch (e) {
        return null;
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar onLogout={logout} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-white sticky top-0 z-10">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Your Rooms</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex gap-2">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button variant="default">Create Room</Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm w-full">
                <h3 className="text-lg font-semibold mb-2">Create a New Room</h3>
                <Input
                  placeholder="Room name"
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  className="mb-3"
                  disabled={creating}
                />
                <Button
                  className="w-full"
                  onClick={handleCreateRoom}
                  disabled={!newRoomName || creating}
                >
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          <section className="bg-white p-5 rounded-md shadow-sm border space-y-3 max-w-xl mx-auto w-full">
            <h2 className="text-lg sm:text-xl font-semibold">Join a Room</h2>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Input
                placeholder="Enter room name or slug"
                value={roomSlug}
                onChange={(e) => setRoomSlug(e.target.value)}
              />
              <Button onClick={joinRoom}>Join</Button>
            </div>
          </section>

          <section>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Your Rooms</h2>
            {rooms.length === 0 ? (
              <div className="flex justify-center py-12">
                <p className="text-sm text-muted-foreground">No rooms found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
                {rooms.map((room) => (
                  <Card key={room._id} className="bg-white border-zinc-800 shadow-xl rounded-2xl p-8 min-h-[320px] flex flex-col items-center justify-between">
                    <CardHeader className="w-full flex flex-col items-center pb-2">
                      <CardTitle className="text-xl font-bold text-black text-center truncate w-full">
                        {room.slug}
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="flex flex-col flex-1 items-center justify-center w-full">
                      <p className="text-base text-gray-800 mb-8">
                        <span className="font-semibold">Role:</span>{" "}
                        {room.adminId === getUserIdFromToken() ? "Admin" : "Member"}
                      </p>

                      <div className="flex flex-col gap-4 w-full">
                        <Button
                          className="w-full flex items-center justify-center gap-2 py-3 text-lg font-semibold"
                          onClick={() => {
                            setLoadingCanvasId(room._id);
                            router.push(`/canvas/${room._id}`);
                          }}
                          disabled={loadingCanvasId === room._id}
                        >
                          <PencilIcon className="w-5 h-5" />
                          Open Canvas
                        </Button>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              className="w-full flex items-center justify-center gap-2 py-3 text-lg font-semibold bg-zinc-900 text-white"
                              onClick={() => setSelectedRoom(room)}
                            >
                              <UserPlusIcon className="w-5 h-5" />
                              Add
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="space-y-4">
                            <h3 className="text-lg font-semibold">Add Collaborator</h3>
                            <div className="space-y-2">
                              <Label>Username</Label>
                              <Input
                                placeholder="Enter username"
                                value={collabUsername}
                                onChange={(e) => setCollabUsername(e.target.value)}
                              />
                              <Label>Email</Label>
                              <Input
                                placeholder="Enter user email"
                                value={collabUseremail}
                                onChange={(e) => setCollabUseremail(e.target.value)}
                              />
                            </div>
                            <Button className="w-full" onClick={addCollaborator}>
                              Send Invite
                            </Button>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// 2. Wrap the Content in Suspense as the default export
export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <p className="text-zinc-500 animate-pulse">Initializing Dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}