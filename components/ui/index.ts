// Shadcn/ui components — lowercase paths match shadcn's internal imports (macOS resolves both)
export { Button } from './button';
export { Card, CardHeader, CardTitle, CardContent, CardFooter } from './card';
export { Input } from './input';
export { Textarea } from './textarea';
export { Badge, badgeVariants } from './badge';
export { Skeleton } from './skeleton';
export { Separator } from './separator';
export { Switch } from './switch';
export { Label } from './label';
export {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from './sheet';
export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from './dialog';
export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTrigger,
  AlertDialogAction,
  AlertDialogCancel,
} from './alert-dialog';
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './dropdown-menu';
export { Toaster as Sonner } from './sonner';

// Legacy custom components (kept for backwards compatibility during migration)
export { Modal, ModalFooter } from './Modal';

// Project-specific components (not replaced by shadcn)
export { default as DateInput } from './DateInput';
export { default as TimeInput } from './TimeInput';
