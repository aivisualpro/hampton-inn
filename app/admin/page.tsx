
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Package, Settings as SettingsIcon, MapPin, ChevronRight, Droplets, History, FileText } from "lucide-react";
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
      image: "/bg_transactions.png", // Placeholder or generate later
      href: "/admin/transactions",
    },
    {
      title: "Reports",
      description: "View analytics",
      icon: FileText,
      color: "text-violet-600",
      image: "/bg_reports.png",
      href: "/admin/reports",
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => (
          <Link href={module.href} key={module.title} className="block group">
            <Card
              className="group transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:-translate-y-2 border-0 relative overflow-hidden h-[220px] ring-1 ring-black/5"
              style={{
                backgroundImage: `url(${module.image})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/95 via-white/70 to-white/30 group-hover:from-white/90 group-hover:to-white/40 transition-all duration-300" />

              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 relative z-10 pt-6 px-6">
                <CardTitle className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none" style={{ fontFamily: 'Audiowide, sans-serif' }}>
                  {module.title}
                </CardTitle>
                <module.icon className={`h-8 w-8 ${module.color} transition-transform duration-300 group-hover:scale-110`} />
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-sm text-gray-600 mt-2 font-medium px-6">
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
