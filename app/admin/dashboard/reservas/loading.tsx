export default function Loading() {
    return (
        <div className="p-6 space-y-4">
            <div className="h-8 w-48 bg-neutral-100 rounded animate-pulse" />
            <div className="h-10 w-full bg-neutral-100 rounded animate-pulse" />
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 w-full bg-neutral-50 rounded animate-pulse" />
            ))}
        </div>
    );
}
