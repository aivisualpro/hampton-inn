
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="w-full h-full p-4 md:p-6">
      <Tabs defaultValue="imports" className="w-full space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="imports" className="data-[state=active]:bg-background">Imports</TabsTrigger>
          <TabsTrigger value="general" disabled className="opacity-50 cursor-not-allowed">General</TabsTrigger>
        </TabsList>
        
        <TabsContent value="imports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center p-6 space-y-4 h-[200px]">
                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="font-semibold text-lg">Import Items</h3>
                  <p className="text-xs text-muted-foreground">Upload CSV/Excel file</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="general">
           {/* Placeholder for future general settings */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
