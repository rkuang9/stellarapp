import ImageSegmentationInterface from "@/features/training/image_segmentation/interface";
import { Metadata } from "next";


export const metadata: Metadata = {
    title: `${process.env.NEXT_PUBLIC_PROJECT_NAME} | Create an image segmentation model`,
    description: "Train your own machine learning model in your browser, on your own hardware, with your data kept private."
}


export default function App() {
    return <ImageSegmentationInterface meta={{}} />
}
