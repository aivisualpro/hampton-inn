
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Package, Settings as SettingsIcon } from "lucide-react";
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
      title: "Items",
      description: "Manage inventory items",
      icon: Package,
      color: "text-orange-600",
      image: "/bg_items.png",
      href: "/admin/items",
    },
    {
      title: "Settings",
      description: "System configuration",
      icon: SettingsIcon,
      color: "text-slate-600",
      image: "/bg_settings.png",
      href: "/admin/settings",
    },
  ];

  return (
    <div className="container mx-auto p-4 md:p-6 mt-6">
       <div className="mb-6 flex items-center gap-2 text-muted-foreground text-sm">
         <Link href="/" className="hover:text-foreground">Home</Link>
         <span>/</span>
         <span className="text-foreground">Administration</span>
       </div>

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
  );
}
