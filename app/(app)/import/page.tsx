import { getCategories } from '@/app/actions/categories'
import { ImportWizard } from '@/components/app/ImportWizard'

export default async function ImportPage() {
  const categories = await getCategories()
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Import Excel / CSV</h1>
      <p className="text-sm text-muted-foreground mb-6">Importez vos transactions depuis un fichier de votre banque</p>
      <ImportWizard categories={categories} />
    </div>
  )
}
