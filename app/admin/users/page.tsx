
"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Pencil, Trash2, MoreHorizontal, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

function RoleCombobox({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false)
  
  // Default roles
  const [roles, setRoles] = useState([
    "Admin",
    "Manager",
    "Staff",
    "Supervisor",
    "Housekeeper"
  ])
  
  const [inputValue, setInputValue] = useState("")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? value
            : "Select role..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search role..." value={inputValue} onValueChange={setInputValue} />
          <CommandList>
            <CommandEmpty>
               <div className="p-2 cursor-pointer text-sm" onClick={() => {
                  setRoles([...roles, inputValue])
                  onChange(inputValue)
                  setOpen(false)
               }}>
                 Create role: <span className="font-bold">"{inputValue}"</span>
               </div>
            </CommandEmpty>
            <CommandGroup>
              {roles.map((role) => (
                <CommandItem
                  key={role}
                  value={role}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : role) // Use original casing from roles array
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === role ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {role}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function LocationsMultiSelect({ 
  value, 
  onChange, 
  options 
}: { 
  value: string[], 
  onChange: (val: string[]) => void,
  options: string[] 
}) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")

  const handleSelect = (currentValue: string) => {
    const isSelected = value.includes(currentValue)
    if (isSelected) {
      onChange(value.filter((v) => v !== currentValue))
    } else {
      onChange([...value, currentValue])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-[40px] py-1 px-3"
        >
          {value.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {value.map((val) => (
                <Badge key={val} variant="secondary" className="mr-1 mb-1">
                  {val}
                </Badge>
              ))}
            </div>
          ) : (
            "Select locations..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search locations..." value={inputValue} onValueChange={setInputValue} />
          <CommandList>
            <CommandEmpty>No location found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={(currentValue) => {
                     // Find the exact casing from options
                     const exactOption = options.find(o => o.toLowerCase() === currentValue.toLowerCase()) || currentValue;
                     handleSelect(exactOption);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(option) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

type User = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  locations: string[];
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Staff",
    locations: [] as string[],
    password: "",
  });
  const [formLoading, setFormLoading] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter users
  const filteredUsers = users.filter((user) => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations");
      if (response.ok) {
        const data = await response.json();
        setAvailableLocations(data.map((l: any) => l.name));
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchLocations();
  }, []);

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        locations: user.locations || [],
        password: "", // Password is never loaded back
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        role: "Staff",
        locations: [],
        password: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setFormLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    const payload = {
      ...formData,
      locations: formData.locations,
    };

    try {
      if (editingUser) {
        // Update
        const res = await fetch(`/api/users/${editingUser._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
      } else {
        // Create
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create");
      }
      await fetchUsers();
      handleCloseDialog();
    } catch (error) {
      console.error("Error submitting form:", error);
      // Here you would typically show a toast error
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchUsers();
    } catch (error) {
       console.error("Error deleting user:", error);
    }
  };

  return (
    <div className="h-full flex flex-col">
       {/* Header with Breadcrumbs & Search */}
      <div className="flex-none h-[6%] min-h-[50px] border-b flex items-center justify-between gap-4 px-4 bg-white z-20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/admin" className="hover:text-primary hover:underline">Admin</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Users</span>
        </div>
        
        <div className="flex items-center gap-2 flex-1 justify-end">
             <div className="relative max-w-sm w-full md:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search users..."
                  className="w-full bg-background pl-8 h-8 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
           </div>
           
           <Button onClick={() => handleOpenDialog()} size="sm" className="h-8">
              <Plus className="mr-2 h-4 w-4" />
              Add User
           </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-0">
      <Card className="border-0 shadow-none bg-transparent rounded-none h-full flex flex-col">
        <CardContent className="p-0 flex-1">
          <div className="border-0 bg-transparent h-full">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white h-full">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow className="hover:bg-muted/50 border-b">
                  <TableHead className="w-[200px] font-semibold pl-4">Name</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Phone</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Locations</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user._id} className="hover:bg-muted/50 border-b">
                      <TableCell className="font-medium pl-4">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal capitalize">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.locations && user.locations.length > 0 ? (
                            user.locations.map((loc, index) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="text-xs font-normal"
                              >
                                {loc}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(user)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600"
                              onClick={() => handleDelete(user._id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 p-4 pb-24">
              {loading ? (
                 <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                 </div>
              ) : filteredUsers.length === 0 ? (
                 <div className="text-center text-muted-foreground py-8">
                   No users found.
                 </div>
              ) : (
                filteredUsers.map((user) => (
                  <Card key={user._id} className="bg-white shadow-sm border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                       <CardTitle className="text-base font-bold">
                         {user.name}
                       </CardTitle>
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 -mr-2">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(user)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600"
                              onClick={() => handleDelete(user._id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center text-muted-foreground">
                           <span className="font-medium mr-2 text-foreground">Email:</span> {user.email}
                        </div>
                        {user.phone && (
                          <div className="flex items-center text-muted-foreground">
                             <span className="font-medium mr-2 text-foreground">Phone:</span> {user.phone}
                          </div>
                        )}
                        <div className="flex items-center">
                           <Badge variant="secondary" className="font-normal capitalize mr-2">
                              {user.role}
                           </Badge>
                        </div>
                        {user.locations && user.locations.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                             {user.locations.map((loc, i) => (
                               <Badge key={i} variant="outline" className="text-xs font-normal">
                                 {loc}
                               </Badge>
                             ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add User"}</DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <div className="col-span-3">
                 <RoleCombobox 
                    value={formData.role} 
                    onChange={(val) => setFormData({ ...formData, role: val })} 
                 />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="locations" className="text-right">
                Locations
              </Label>
              <div className="col-span-3">
                 <LocationsMultiSelect 
                   value={formData.locations}
                   options={availableLocations}
                   onChange={(val) => setFormData({ ...formData, locations: val })}
                 />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="col-span-3"
                placeholder={editingUser ? "Leave blank to keep current" : "Required for login"}
                required={!editingUser}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? (
                   <>
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Saving...
                   </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
