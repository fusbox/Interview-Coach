import { ComponentGallery } from "../components/ComponentGallery";

export const metadata = {
    title: "Component Gallery | Interview Coach",
    description: "Design system verification gallery",
};

export default function GalleryPage() {
    return (
        <div className="container py-12">
            <ComponentGallery />
        </div>
    );
}
