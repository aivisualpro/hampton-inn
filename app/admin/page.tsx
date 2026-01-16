
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Package, Settings as SettingsIcon, MapPin, ChevronRight, Droplets, History } from "lucide-react";
import Link from "next/link"; // Although we'll likely click through, for now just cards

export default function AdminPage() {
  const modules = [
    {
      title: "Users",
      description: "Manage system users",
      icon: Users,
      color: "text-indigo-600",
      image: "/bg_users.png",
      href: "/admin/users",
    },
    {
      title: "Settings",
      description: "System configuration",
      icon: SettingsIcon,
      color: "text-slate-600",
      image: "/bg_settings.png",
      href: "/admin/settings",
    },
    {
      title: "Locations",
      description: "Manage locations",
      icon: MapPin,
      color: "text-teal-600",
      image: "/bg_locations.png",
      href: "/admin/locations",
    },
    {
      title: "Items",
      description: "Manage inventory items",
      icon: Package,
      color: "text-orange-600",
      image: "/bg_items.png",
      href: "/admin/items",
    },
    {
      title: "Transactions",
      description: "View transaction history",
      icon: History,
      color: "text-purple-600",
      image: "", // Placeholder or generate later
      href: "/admin/transactions",
    },

  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header with Breadcrumbs */}
      <div className="flex-none h-[6%] min-h-[50px] border-b flex items-center justify-between gap-4 px-4 bg-white z-20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary hover:underline">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Administration</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {modules.map((module) => (
          <Link href={module.href} key={module.title} className="block group">
            <Card
              className="transition-all duration-200 cursor-pointer shadow-sm group-hover:shadow-md border-0 relative overflow-hidden h-[160px]"
              style={{
                backgroundImage: `url(${module.image})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 bg-white/70 group-hover:bg-white/50 transition-colors duration-200" />

              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-bold text-gray-900">
                  {module.title}
                </CardTitle>
                <module.icon className={`h-5 w-5 ${module.color}`} />
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-xs text-gray-800 mt-1 font-semibold">
                  {module.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        </div>
      </div>
    </div>
  );
}
