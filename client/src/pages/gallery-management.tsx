import { AppShell } from "@/components/AppShell";
import GalleryPhotoManager from "@/components/GalleryPhotoManager";

export default function GalleryManagementPage() {
  return (
    <AppShell title="Gallery Management">
      <div className="p-6">
        <GalleryPhotoManager />
      </div>
    </AppShell>
  );
}
