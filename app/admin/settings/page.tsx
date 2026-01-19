"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRef, useState, useEffect } from "react";

export default function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{type: 'success' | 'error' | null, message: string}>({ type: null, message: '' });
  
  // General Settings State
  const [settings, setSettings] = useState({
      defaultKingRoomCount: 0,
      defaultDoubleQueenRoomCount: 0,
      parLevelThreshold: 1
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Fetch Settings on Mount
  useEffect(() => {
      fetch("/api/settings")
          .then(res => res.json())
          .then(data => {
              if (data && !data.error) {
                  setSettings({
                      defaultKingRoomCount: data.defaultKingRoomCount || 0,
                      defaultDoubleQueenRoomCount: data.defaultDoubleQueenRoomCount || 0,
                      parLevelThreshold: data.parLevelThreshold ?? 1
                  });
              }
          })
          .catch(console.error);
  }, []);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const processCSV = (str: string) => {
    const headers = str.slice(0, str.indexOf('\n')).split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = str.slice(str.indexOf('\n') + 1).split('\n');

    const newArray = rows.map( row => {
        if (!row.trim()) return null;
        // Split by comma ignoring commas in quotes
        const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(val => val.trim().replace(/^"|"$/g, ''));
        
        const el: any = {};
        
        // Map common CSV headers to our schema keys
        headers.forEach((header, index) => {
            const val = values[index];
            const lowerHeader = header.toLowerCase();
            
            if (lowerHeader.includes('item') || lowerHeader === 'name') el.item = val;
            else if (lowerHeader.includes('sub')) el.subCategory = val;
            else if (lowerHeader.includes('category')) el.category = val;
            else if (lowerHeader.includes('cost')) el.costPerPackage = val;
            else if (lowerHeader.includes('restock')) el.restockPackageQty = val; // Check restock BEFORE package
            else if (lowerHeader.includes('package')) el.package = val;
            else if (lowerHeader.includes('king')) el.defaultKingRoomQty = val;
            else if (lowerHeader.includes('queen') || lowerHeader.includes('double')) el.defaultDoubleQueenQty = val;
        });
        return el;
    }).filter(Boolean);

    return newArray;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus({ type: null, message: '' });

    try {
      const text = await file.text();
      const items = processCSV(text);

      if (items.length === 0) {
        throw new Error("No items found in CSV");
      }

      console.log("Parsed items:", items); // For debugging

      const res = await fetch("/api/imports/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to import");
      }

      setStatus({ type: "success", message: data.message });
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      console.error(error);
      setStatus({ type: "error", message: error.message });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async () => {
      setSettingsSaving(true);
      try {
          await fetch("/api/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(settings)
          });
          // Show quick success state if needed
      } catch(e) {
          console.error(e);
      } finally {
          setSettingsSaving(false);
      }
  }

  const downloadTemplate = () => {
    const headers = [
      "Item",
      "Category",
      "Sub Category",
      "Cost Per Package",
      "Package",
      "Restock Package Qty",
      "Default King Room Qty",
      "Default Double Queen Qty"
    ];
    const csvContent = headers.join(",") + "\n" + "Example Soap,Housekeeping,Bath,15.50,Box of 100,5,2,2";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "items_import_template.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  }

  return (
    <div className="w-full h-full p-0">
      <Tabs defaultValue="imports" className="w-full h-full flex flex-col">
        <div className="border-b px-4 py-2 bg-muted/20">
             <TabsList className="bg-transparent p-0 gap-4">
              <TabsTrigger 
                value="imports" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 pb-2 transition-none"
              >
                Imports
              </TabsTrigger>
              <TabsTrigger 
                value="general" 
                className="rounded-none px-2 pb-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary transition-none"
              >
                General
              </TabsTrigger>
            </TabsList>
        </div>
        
        <TabsContent value="imports" className="flex-1 p-4 space-y-4 m-0 overflow-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-medium">Data Import</h2>
                    <p className="text-sm text-muted-foreground">Import items and inventory data from CSV.</p>
                </div>
                <Button variant="outline" onClick={downloadTemplate} size="sm">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Download Template
                </Button>
            </div>
            
            {status.message && (
                <div className={`p-4 rounded-md border flex items-start gap-3 ${status.type === 'success' ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                    <div className="mt-0.5">
                        {status.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    </div>
                    <div className="grid gap-1">
                        <h5 className="font-medium leading-none tracking-tight">{status.type === 'success' ? "Success" : "Error"}</h5>
                        <div className="text-sm opacity-90">{status.message}</div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv"
                onChange={handleFileChange}
              />
              <Card 
                className={`hover:shadow-md transition-all cursor-pointer border-dashed border-2 group ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={handleClick}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 space-y-4 h-[200px]">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${uploading ? 'bg-yellow-50 text-yellow-600' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'}`}>
                    {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  </div>
                  <div className="text-center space-y-1">
                    <h3 className="font-semibold text-lg">{uploading ? "Importing..." : "Import Items"}</h3>
                    <p className="text-xs text-muted-foreground">Click to upload CSV</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="general" className="flex-1 p-4 space-y-6 m-0 overflow-auto">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Room Configuration</CardTitle>
                    <CardDescription>Set the total number of rooms for each type in the hotel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="kingRooms"># of King Rooms</Label>
                            <Input 
                                id="kingRooms" 
                                type="number" 
                                min="0"
                                value={settings.defaultKingRoomCount} 
                                onChange={(e) => setSettings({...settings, defaultKingRoomCount: parseInt(e.target.value) || 0})}
                                onWheel={(e) => e.currentTarget.blur()}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="queenRooms"># of Double Queen Rooms</Label>
                            <Input 
                                id="queenRooms" 
                                type="number" 
                                min="0"
                                value={settings.defaultDoubleQueenRoomCount} 
                                onChange={(e) => setSettings({...settings, defaultDoubleQueenRoomCount: parseInt(e.target.value) || 0})}
                                onWheel={(e) => e.currentTarget.blur()}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="parThreshold">Par Level Threshold</Label>
                            <Input 
                                id="parThreshold" 
                                type="number" 
                                min="0"
                                step="0.1"
                                value={settings.parLevelThreshold} 
                                onChange={(e) => setSettings({...settings, parLevelThreshold: parseFloat(e.target.value) || 0})}
                                onWheel={(e) => e.currentTarget.blur()}
                            />
                        </div>
                    </div>
                    <div className="flex justify-start pt-4">
                         <Button onClick={handleSaveSettings} disabled={settingsSaving}>
                            {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                            Save Changes
                         </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
