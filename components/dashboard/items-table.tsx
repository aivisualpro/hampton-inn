
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { items } from "@/lib/data";
import { Badge } from "@/components/ui/badge";

export function ItemsTable() {
  return (
    <div className="rounded-md border bg-card text-card-foreground shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-muted/50">
            <TableHead className="min-w-[200px] font-semibold">Item</TableHead>
            <TableHead className="font-semibold">Category</TableHead>
            <TableHead className="font-semibold">SubCategory</TableHead>
            <TableHead className="font-semibold">Cost</TableHead>
            <TableHead className="font-semibold">Pack Size</TableHead>
            <TableHead className="font-semibold">UOM</TableHead>
            <TableHead className="font-semibold">Bundle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">{item.item}</TableCell>
              <TableCell>{item.category}</TableCell>
              <TableCell>{item.subCategory}</TableCell>
              <TableCell>${item.cost.toFixed(2)}</TableCell>
              <TableCell>{item.packSize}</TableCell>
              <TableCell>{item.uom}</TableCell>
              <TableCell>
                {item.bundle && item.bundle.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <Badge variant="secondary" className="w-fit text-xs">
                       Bundle
                    </Badge>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {item.bundle.map((b, idx) => (
                        <li key={idx}>
                          {b.qty}x {b.itemRef}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
