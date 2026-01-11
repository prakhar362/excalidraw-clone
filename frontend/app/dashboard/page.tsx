'use client';

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'react-toastify';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { 
  flexRender, 
  getCoreRowModel, 
  useReactTable, 
  ColumnDef,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  Pencil, 
  UserPlus, 
  Trash, 
  Link as LinkIcon, 
  ArrowUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Users
} from "lucide-react";
import { BACKEND_URL } from '../../config';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Room {
  _id: string;
  slug: string;
  createdAt: string;
  adminId: string;
  collaborators?: any[]; // For user count
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  
  const [token, setToken] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomSlug, setRoomSlug] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [collabUsername, setCollabUsername] = useState('');
  const [collabUseremail, setCollabUseremail] = useState('');

  const toastOptions = { position: 'top-right' as const, autoClose: 2000, theme: 'dark' as const };

  useEffect(() => {
    const savedToken = localStorage.getItem('token') || searchParams.get('token');
    if (savedToken) {
      setToken(savedToken);
      fetchRooms(savedToken);
    } else {
      router.push('/auth');
    }
  }, [searchParams]);

  const fetchRooms = async (activeToken: string) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/my-rooms`, {
        headers: { Authorization: activeToken },
      });
      setRooms(res.data.rooms);
    } catch (err) { console.error("Fetch failed", err); }
  };

  const getUserIdFromToken = () => {
    if (!token) return null;
    try { return JSON.parse(atob(token.split(".")[1])).userId; } catch (e) { return null; }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName || !token) return;
    setCreating(true);
    try {
      await axios.post(`${BACKEND_URL}/create-room`, { name: newRoomName }, { headers: { Authorization: token } });
      toast.success('Room created!', toastOptions);
      setNewRoomName('');
      setShowCreateDialog(false);
      fetchRooms(token);
    } catch (e: any) { 
      toast.error(e?.response?.data?.message || 'Error creating room', toastOptions); 
    } finally { setCreating(false); }
  };

  const joinRoom = async () => {
    if (!roomSlug) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/room/${roomSlug}`);
      if (res.data.room?._id) router.push(`/canvas/${res.data.room._id}`);
    } catch (e) { toast.error("Room not found", toastOptions); }
  };

  const deleteRoom = async (roomId: string) => {
    if (!token) return;
    try {
      await axios.delete(`${BACKEND_URL}/room/${roomId}`, { headers: { Authorization: token } });
      toast.success("Room deleted", toastOptions);
      fetchRooms(token);
    } catch (e) { toast.error("Delete failed", toastOptions); }
  };

  const logout = () => {
    localStorage.removeItem('token');
    router.push('/auth');
  };

  const columns: ColumnDef<Room>[] = useMemo(() => [
    {
      accessorKey: "slug",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 hover:bg-transparent">
          Room Name <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="font-semibold text-neutral-800 dark:text-neutral-200">{row.getValue("slug")}</div>,
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => {
        const isAdmin = row.original.adminId === getUserIdFromToken();
        return (
          <div className={cn(
            "inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium",
            isAdmin ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
          )}>
            {isAdmin ? "Admin" : "Member"}
          </div>
        );
      },
    },
    {
      id: "users",
      header: "Current Users",
      cell: ({ row }) => {
        const count = (row.original.collaborators?.length || 0) + 1; // +1 for admin
        return (
          <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <Users className="h-4 w-4" />
            {count}
          </div>
        );
      }
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => <div className="text-sm text-neutral-500">{new Date(row.getValue("createdAt")).toLocaleDateString()}</div>,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const room = row.original;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => router.push(`/canvas/${room._id}`)}>
                  <Pencil className="mr-2 h-4 w-4" /> Open Canvas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedRoom(room); setShowAddUserDialog(true); }}>
                  <UserPlus className="mr-2 h-4 w-4" /> Add User
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                   navigator.clipboard.writeText(`${window.location.origin}/canvas/${room._id}`);
                   toast.success("Link copied!");
                }}>
                  <LinkIcon className="mr-2 h-4 w-4" /> Copy Link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => deleteRoom(room._id)} className="text-red-600 focus:text-red-600">
                  <Trash className="mr-2 h-4 w-4" /> Delete Room
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], [token, rooms]);

  const table = useReactTable({
    data: rooms,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, columnFilters },
    initialState: { pagination: { pageSize: 7 } }
  });

  return (
    <div className="mx-auto flex w-full flex-1 flex-col overflow-hidden border border-neutral-200 bg-gray-50 md:flex-row dark:border-neutral-700 dark:bg-neutral-900 h-screen">
      <AppSidebar onLogout={logout} />

      <div className="flex flex-1 flex-col overflow-y-auto bg-white dark:bg-neutral-900">
        {/* Updated Header with Join and Create Actions */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-6 sticky top-0 z-10 bg-white dark:bg-neutral-900 gap-4">
          <Breadcrumb className="hidden lg:block">
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink href="#">Dashboard</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Workspace</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-2">
              <Input 
                placeholder="Join Room via Name..." 
                value={roomSlug} 
                onChange={(e) => setRoomSlug(e.target.value)}
                className="h-9 w-40 lg:w-60 dark:bg-neutral-800 rounded-sm"
              />
              <Button variant="secondary" size="sm" onClick={joinRoom} className="h-9 rounded-sm">Join</Button>
            </div>
            <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />
            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="h-9 gap-2 rounded-sm">
              <PlusCircle className="h-4 w-4" /> Create Room
            </Button>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {/* Your Rooms Search Section */}
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-bold dark:text-white">Your Rooms</h1>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Filter search..."
                value={(table.getColumn("slug")?.getFilterValue() as string) ?? ""}
                onChange={(event) => table.getColumn("slug")?.setFilterValue(event.target.value)}
                className="pl-9 dark:bg-neutral-800 rounded-sm"
              />
            </div>
          </div>

          <div className="rounded-sm border dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-neutral-50 dark:bg-neutral-900/50">
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map(row => (
                    <TableRow key={row.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/40 border-b dark:border-neutral-700 last:border-0">
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id} className="py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-neutral-500">No rooms found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between px-2">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </p>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="rounded-sm h-8">
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="rounded-sm h-8">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="rounded-sm">
          <DialogHeader><DialogTitle>New Workspace Room</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Room Name</Label>
              <Input placeholder="e.g. creative-sprint" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} className="rounded-sm" />
            </div>
          </div>
          <Button className="w-full rounded-sm" onClick={handleCreateRoom} disabled={creating || !newRoomName}>
            {creating ? 'Creating...' : 'Create Room'}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="rounded-sm">
          <DialogHeader><DialogTitle>Invite Collaborator</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Name</Label><Input placeholder="John Doe" value={collabUsername} onChange={e => setCollabUsername(e.target.value)} className="rounded-sm" /></div>
            <div className="space-y-2"><Label>Email</Label><Input placeholder="john@example.com" value={collabUseremail} onChange={e => setCollabUseremail(e.target.value)} className="rounded-sm" /></div>
          </div>
          <Button className="w-full rounded-sm" onClick={() => setShowAddUserDialog(false)}>Send Invitation</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Separator helper for the header
const Separator = ({ orientation, className }: { orientation: string, className?: string }) => (
  <div className={cn("bg-neutral-200 dark:bg-neutral-700", orientation === "vertical" ? "w-[1px]" : "h-[1px]", className)} />
);

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-neutral-900"><Skeleton className="h-12 w-12 rounded-full" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}