import { toast } from "sonner";

interface ToastOptions {
    duration?: number;
}

function toastSuccess(message: React.ReactNode, { duration }: ToastOptions = { duration: undefined }) {
    toast.success(message, { action: { label: "Close", onClick: () => { } }, duration });
}


function toastInfo(message: React.ReactNode, { duration }: ToastOptions = { duration: undefined }) {
    toast.info(message, { action: { label: "Close", onClick: () => { } }, duration });
}


function toastError(message: React.ReactNode, { duration }: ToastOptions = { duration: undefined }) {
    toast.error(message, { action: { label: "Close", onClick: () => { } }, duration });
}


export const toaster = {
    success: toastSuccess,
    info: toastInfo,
    error: toastError
};
