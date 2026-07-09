import JSZip from "jszip";
import { freeImage } from "@/lib/utility";


export interface ImageView {
    path: string;
    url: string | undefined;
}


export default class ImageDataset {
    public jszip: JSZip = new JSZip();
    public readonly image_categories: { [key: string]: ImageView[] } = {};
    private length: number = 0;

    // hold the image dataset file buffer to be sent to a web worker for dataset generation
    private file: File = new File([], "");

    constructor() {
        // nothing to do
    }


    /**
     * Image loader. This static function expects a zip folder where the first sub-level are folders
     * containing images belonging to an image category.
     * 
     * @param zip_folder the zip folder
     * @param lazy fast initial load by not not loading blobs to memory until individually called by `.images(...)`
     */
    public static async load(zip_folder: File, lazy: boolean = false): Promise<ImageDataset> {
        const imageset = new ImageDataset();
        const zip = await imageset.jszip.loadAsync(zip_folder);
        imageset.file = new File([zip_folder], zip_folder.name);

        // object where keys are the paths to all possible files within the zip
        const files = Object.keys(zip.files);

        for (const file of files) {
            const path = file.split("/");

            if (path.length != 3) {
                continue;
            }

            const image_category = path[1];
            const image_name = path[2];

            // expect a file structure of zip-folder-name/category-name/image-name.jpg
            if (!image_name || (!image_name.endsWith(".png") && !image_name.endsWith(".jpeg") && !image_name.endsWith(".jpg") && !image_name.endsWith(".webp"))) {
                continue;
            }

            if (!imageset.image_categories[image_category]) {
                imageset.image_categories[image_category] = [];
            }

            imageset.image_categories[image_category].push({
                path: file,
                url: lazy ? undefined : URL.createObjectURL(await zip.files[file].async("blob"))
            });

            imageset.length++;
        }

        for (const i in imageset.image_categories) {
            imageset.image_categories[i].sort((a, b) => a.path < b.path ? -1 : 1);
        }

        return imageset;
    }


    public from(imageset: ImageDataset) {
        this.reset();

        this.jszip = imageset.jszip;
        this.file = imageset.file;
        this.length = imageset.length;

        for (const i in imageset.image_categories) {
            this.image_categories[i] = imageset.image_categories[i];
        }
    }


    public category(image_category: string): Readonly<ImageView[]> {
        if (!this.image_categories[image_category]) {
            return [];
        }

        return this.image_categories[image_category];
    }


    public get categories(): string[] {
        return Object.keys(this.image_categories);
    }


    /**
     * Get a range of images from a specific category. Images that haven't yet been
     * loaded as blobs will be done so.
     * 
     * @param category the image category
     * @param index the image index to start at
     * @param amount the amount of images starting from the provided index to return
     */
    public async images(category: string, index: number, amount: number = 1): Promise<Readonly<ImageView[]>> {
        if (!this.image_categories[category]) {
            return [];
        }

        const image_view = this.image_categories[category].slice(index, index + amount);

        for (const image of image_view) {
            if (!image.url) {
                image.url = URL.createObjectURL(await this.blob(image.path));
            }
        }

        return image_view;
    }


    public async blob(path: string) {
        return this.jszip.files[path].async("blob");
    }


    // frees the blobs for garbage collection and returns this object is an uninitialized state
    public reset(): void {
        this.length = 0;
        this.file = new File([], "");

        this.jszip = new JSZip();
        const paths = Object.keys(this.image_categories);

        for (const path of paths) {
            for (const { url } of this.image_categories[path]) {
                if (url) {
                    this.free(url);
                }
            }

            delete this.image_categories[path];
        }
    }


    /**
     * Deallocate the image from memory for garbage collection
     * 
     * @param url   the image blob's URL
     */
    public free(url: string): void {
        freeImage(url);
    }


    /**
     * Generate a set of samples and labels out of this image dataset
     * 
     * @param image_categories categories to create a dataset out of
     * @returns a samples array of image blobs and labels array indicating the image's class
     */
    public async dataset(image_categories: string[]): Promise<{
        x_train: Blob[],
        y_train: string[];
    }> {
        if (this.categories.length == 0) {
            throw Error("ImageDataset.dataset: Dataset is empty");
        }

        const invalid_categories = image_categories.filter(i => this.image_categories[i] == undefined);

        if (invalid_categories.length > 0) {
            throw Error(`ImageDataset.dataset: Invalid image categories provided: ${invalid_categories.join(", ")}`);
        }

        const x_train: Blob[] = [];
        const y_train: string[] = [];
        const categories = Object.keys(this.image_categories).filter(i => image_categories.includes(i));

        for (const category of categories) {
            if (this.image_categories[category]) {
                for (const { path } of this.image_categories[category]) {
                    x_train.push(await this.blob(path));
                    y_train.push(category);
                }
            }
        }

        return { x_train, y_train };
    }


    async arrayBuffer() {
        return this.file.arrayBuffer();
    }


    public get size(): number {
        return this.length;
    }
}
