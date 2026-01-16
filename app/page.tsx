
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
      href: "/soak-cycle",
    },
    {
      title: "Stock Purchase",
      description: "Order new supplies",
      icon: ShoppingCart,
      color: "text-emerald-600",
      image: "/bg_stock_purchase.png",
      value: "3 Pending",
    },

  ];

  return (
    <div className="container mx-auto p-4 md:p-6 mt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((module) => {
           const CardComponent = (
             <Card
                className="group transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:-translate-y-2 border-0 relative overflow-hidden h-[220px] ring-1 ring-black/5"
                style={{
                    backgroundImage: `url(${module.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
              >
                {/* Overlay to ensure text readability */}
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