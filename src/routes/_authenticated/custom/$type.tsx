import { createFileRoute } from "@tanstack/react-router";
import { AssetManager } from "@/components/asset-manager";
import { useProfile } from "@/lib/use-profile";

export const Route = createFileRoute("/_authenticated/custom/$type")({
  component: CustomSheetPage,
});

function CustomSheetPage() {
  const { type } = Route.useParams();
  const decoded = decodeURIComponent(type);
  const profileQ = useProfile();
  const subtypes = profileQ.data?.custom_panel_subtypes?.[decoded] ?? [];
  const allowedTypes =
    subtypes.length > 0
      ? subtypes.map((s) => ({ value: s as any, label: s }))
      : [{ value: "STOCK_US" as any, label: decoded }];
  return (
    <AssetManager
      title={decoded}
      defaultType={allowedTypes[0].value}
      allowedTypes={allowedTypes}
      filterTypes={[]}
      customTypeName={decoded}
    />
  );
}
