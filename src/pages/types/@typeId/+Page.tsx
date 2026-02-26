import { createMemo } from "solid-js"
import { canonicalId } from "@/data/formatters"
import { TypesPageView } from "@/pages/types/TypesPageView"
import { useParams } from "@/route-tree.gen"

export default function Page() {
  const params = useParams({ from: "/types/@typeId" })
  const initialType = createMemo(() => canonicalId(String(params().typeId ?? "")))

  return <TypesPageView initialType={initialType()} />
}
