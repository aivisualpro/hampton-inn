
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileBarChart, ChevronRight } from "lucide-react";

export default function ReportsDashboard() {
  return (
    <div className="flex flex-col h-full bg-muted/10">
       {/* Header */}
       <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/" className="hover:text-primary hover:underline">Home</Link>
                <ChevronRight className="h-4 w-4" />
                <Link href="/admin" className="hover:text-primary hover:underline">Admin</Link>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">Reports</span>
            </div>
       </div>

       {/* Content */}
       <div className="p-6 overflow-auto">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {/* Par Level Report Card */}
               <Link href="/admin/reports/par-level" className="block h-full">
                    <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer bg-gradient-to-br from-indigo-50 to-blue-50 border-blue-100">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xl font-semibold text-indigo-700">
                                Par Level Report
                            </CardTitle>
                            <FileBarChart className="h-6 w-6 text-indigo-500" />
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-indigo-600/80">
                                Analyze inventory par levels based on room configuration and item requirements.
                            </p>
                        </CardContent>
                    </Card>
               </Link>
           </div>
       </div>
    </div>
  );
}
