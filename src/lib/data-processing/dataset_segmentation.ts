import { getFileNameNoExtension } from "@/lib/utility";
import { decode } from "tiff";
import { encode } from "fast-png"

export interface SegmentationImages {
    image?: File,
    mask?: File,
    image_url?: string;
    mask_url?: string;
}


export type ImageType = "image" | "mask";


export const MASK_SUFFIXES: string[] = [
    "mask",
    "seg", "segmentation",
    "gt", "groundtruth",
    "anno", "annotation",
    "label",
    "overlay",
    "manual",
    "roi"
]


export default class SegmentationDataset {
    protected images: Map<string, SegmentationImages> = new Map();
    protected image_list: string[] = [];


    constructor() { }


    public async loadImage(image: File | File[]) {
        if (Array.isArray(image)) {
            for (const file of image) {
                await this.load(file, "image")
            }
        } else {
            await this.load(image, "image");
        }

        this.updateImageList();
    }


    public async loadMask(image: File | File[]) {
        if (Array.isArray(image)) {
            for (const file of image) {
                await this.load(file, "mask")
            }
        } else {
            await this.load(image, "mask");
        }

        this.updateImageList();
    }


    public get(name: string) {
        return this.images.get(name);
    }


    public get files() {
        return this.image_list;
    }


    private async load(image: File, type: ImageType) {
        if (!image.type.includes("image")) {
            throw Error(`SegmentationDataset.load: file ${image.name} is not an image (${image.type})`);
        }

        const name_no_extension = getFileNameNoExtension(image.name.toLowerCase());
        const name_no_suffix = name_no_extension.replace(new RegExp(`${MASK_SUFFIXES.join('|')}`, 'g'), "");
        const name = name_no_suffix.replace(/[^a-z0-9]/gi, "") // discard non-alphanumeric

        if (MASK_SUFFIXES.filter(suffix => name_no_extension.includes(suffix)).length > 0) {
            type = "mask";
        }

        if (!name) {
            throw Error(`SegmentationDataset.load: invalid image file name ${image.name}`);
        }

        const image_pair = this.images.get(name) ?? {};
        image_pair[type] = image;

        if (image.type == "image/tiff") {
            // to be lazily loaded
            //image_pair[`${type}_url`] = URL.createObjectURL(await tiffToPNG(image));
        } else {
            image_pair[`${type}_url`] = URL.createObjectURL(image);
        }


        this.images.set(name, image_pair);
    }


    private updateImageList() {
        this.image_list = this.images.keys().toArray()
    }


    public async lazyDisplayImage(name: string, type: ImageType) {
        const image_pair = this.images.get(name);

        if (!image_pair || !image_pair[type]) {
            throw Error(`SegmentationDataset.lazyDisplayImage: image ${name} does not exist`);
        }

        if (!image_pair[`${type}_url`]) {
            if (image_pair[type].type == "image/tiff") {
                image_pair[`${type}_url`] = URL.createObjectURL(await tiffToPNG(image_pair[type]));
            }
        }

        return !!image_pair[`${type}_url`];
    }


    public freeAllImages() {
        for (const [name, pair] of this.images) {
            if (pair.image_url) {
                URL.revokeObjectURL(pair.image_url)
            }

            if (pair.mask_url) {
                URL.revokeObjectURL(pair.mask_url)
            }
        }
    }


    public reset() {
        for (const [name, pair] of this.images) {
            if (pair.image_url) {
                URL.revokeObjectURL(pair.image_url)
            }

            if (pair.mask_url) {
                URL.revokeObjectURL(pair.mask_url)
            }
        }

        this.image_list = [];
        this.images.clear();
    }


    public async dataset(): Promise<{
        x_train: File[],
        y_train: File[];
    }> {
        const x_train: File[] = [];
        const y_train: File[] = [];

        for (const [name, pair] of this.images) {
            if (pair.image && pair.mask &&
                pair.image.type.includes("image") && pair.mask.type.includes("image")) {
                x_train.push(pair.image);
                y_train.push(pair.mask);
            }
        }

        return { x_train, y_train };
    }


    /**
     * The number of image mask pairs where both are present
     */
    public get size() {
        let count = 0;

        this.images.forEach((pair) => {
            if (pair.image && pair.mask) {
                count++
            }
        })

        return count;
    }
}


export async function tiffToPNG(image: File) {
    const tiff_ids = decode(await image.arrayBuffer());

    const { height, width, data } = tiff_ids[0];
    const png_buffer = encode({ height, width, data: data as any, channels: data.length / (height * width) });

    return new File([png_buffer as any], getFileNameNoExtension(image.name))
}
