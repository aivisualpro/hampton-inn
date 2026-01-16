
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ClipboardList,
  Droplets,
  ShoppingCart,
  FileText,
  Shield,
  LucideIcon,
} from "lucide-react";

type Module = {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  image: string;
  value: string;
  href?: string;
};

export default function Home() {
  const modules: Module[] = [
    {
      title: "Administration",
      description: "Manage users & items",
      icon: Shield,
      color: "text-rose-600",
      image: "/bg_admin.png",
      value: "Admin",
      href: "/admin",
    },
    {
      title: "Stock Count",
      description: "Manage inventory levels",
      icon: ClipboardList,
      color: "text-blue-600",
      image: "/bg_stock_count.png",
      value: "124 Items",
      href: "/stock-count",
    },
    {
      title: "Soak Cycle",
      description: "Track cleaning cycles",
      icon: Droplets,
      color: "text-cyan-600",
      image: "/bg_soak_cycle.png",
      value: "Active",
      href: "/admin/soak-cycle",
    },
    {
      title: "Stock Purchase",
      description: "Order new supplies",
      icon: ShoppingCart,
      color: "text-emerald-600",
      image: "/bg_stock_purchase.png",
      value: "3 Pending",
    },
    {
      title: "Reports",
      description: "View analytics",
      icon: FileText,
      color: "text-violet-600",
      image: "/bg_reports.png",
      value: "Daily",
    },
  ];

  return (
    <div className="container mx-auto p-4 md:p-6 mt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {modules.map((module) => {
           const CardComponent = (
             <Card
                className="transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md border-0 relative overflow-hidden h-[160px]"
                style={{
                    backgroundImage: `url(${module.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
              >
                {/* Overlay to ensure text readability */}
                 <div className="absolute inset-0 bg-white/70 hover:bg-white/50 transition-colors duration-200" />
                 
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                  <CardTitle className="text-sm font-bold text-gray-900">
                    {module.title}
                  </CardTitle>
                  <module.icon className={`h-5 w-5 ${module.color}`} />
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className={`text-2xl font-extrabold ${module.color} drop-shadow-sm`}>{module.value}</div>
                  <p className="text-xs text-gray-800 mt-1 font-semibold">
                    {module.description}
                  </p>
                </CardContent>
              </Card>
           );
           
           if (module.href) {
             return (
               <Link href={module.href} key={module.title} className="block">
                 {CardComponent}
               </Link>
             );
           }
           
           return <div key={module.title}>{CardComponent}</div>;
        })}
      </div>
    </div>
  );
}