'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-toastify';

interface Room {
  _id: string;
  slug: string;
  createdAt: string;
  adminId: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [roomSlug, setRoomSlug] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // Fetch rooms created by user
  const fetchRooms = async () => {
    try {
      const res = await axios.get('http://localhost:5000/my-rooms', {
        headers: {
          Authorization: token || '',
        },
      });
      setRooms(res.data.rooms);
    } catch (e) {
      console.error(e);
      toast.error('Failed to fetch rooms');
    }
  };

  useEffect(() => {
    if (!token) {
      router.push('/login');
    } else {
      fetchRooms();
    }
  }, []);

  const createRoom = async () => {
    if (!roomSlug) return;
    try {
      const res = await axios.post(
        'http://localhost:5000/room',
        { name: roomSlug },
        { headers: { Authorization: token || '' } }
      );
      toast.success('Room created!');
      router.push(`/canvas/${res.data.slug}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || 'Error creating room');
    }
  };

  const joinRoom = () => {
    if (!roomSlug) return;
    router.push(`/canvas/${roomSlug}`);
  };

  const logout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  return (
    <main className="max-w-xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to the Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Enter room name / slug"
            value={roomSlug}
            onChange={(e) => setRoomSlug(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={createRoom}>Create Room</Button>
            <Button variant="outline" onClick={joinRoom}>
              Join Room
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Rooms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rooms.length === 0 && <p className="text-sm text-muted-foreground">No rooms yet.</p>}
          {rooms.map((room) => (
            <div
              key={room._id}
              className="cursor-pointer text-blue-600 hover:underline"
              onClick={() => router.push(`/canvas/${room.slug}`)}
            >
              {room.slug}
            </div>
          ))}
        </CardContent>
      </Card>

      <Button variant="destructive" onClick={logout}>
        Logout
      </Button>
    </main>
  );
}
