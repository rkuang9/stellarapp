import { cn } from '@/lib/utils'


export function Gallery({ className, ...div_props }: { columns?: number } & React.ComponentProps<"div">) {
    // grid-cols-[var(--gallery-columns)]
    return (
        <div
            className={cn('grid gap-2', className)}
            //style={{ '--gallery-columns': `repeat(${columns}, minmax(0, 1fr))` } as React.CSSProperties}
            {...div_props}
        />
    )
}


export function GalleryImage({ className, ...img_props }: React.ComponentProps<"img">) {
    // col-span-[var(--gallery-image-span)]
    return (
        <img
            className={cn('rounded-lg w-full h-auto object-cover ', className)}
            //style={{ '--gallery-image-span': `${span}` } as React.CSSProperties}
            {...img_props} alt={img_props.alt}
        />
    )
}


export function GalleryImageCaptioned({ className, caption, ...img_props }: React.ComponentProps<"img"> & { caption: string }) {
    return <div className={cn("flex flex-col gap-2", className)}>
        <img
            id={img_props.id}
            className="rounded-lg w-full h-auto object-cover"
            {...img_props} alt={img_props.alt}
        />

        <span id={img_props.id ? `${img_props.id}-caption` : undefined} title={caption} className="text-xs truncate text-muted-foreground">{caption}</span>
    </div>
}
