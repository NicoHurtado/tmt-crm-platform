// Primitivas responsive del admin.
//
// Regla general: escritorio queda exactamente como está hoy; lo que cambia es lo
// que pasa por debajo de `lg` (1024px), donde ya no cabe una tabla ancha ni una
// barra de filtros en línea.
export { AdminPage, AdminPageHeader, AdminTabs, AdminTab } from './AdminPage'
export { FilterShell, FilterField, type FilterChip } from './FilterShell'
export { ComboboxFilter, type ComboboxOption } from './ComboboxFilter'
export {
  DataCardList,
  TableWrap,
  DataCard,
  DataCardHeader,
  DataCardFields,
  DataCardField,
  DataCardFooter,
  EmptyState,
} from './DataCard'
export { Pagination } from './Pagination'
