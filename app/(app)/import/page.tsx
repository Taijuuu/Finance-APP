import { getCategories } from '@/app/actions/categories'
import { ImportWizard } from '@/components/app/ImportWizard'
import { ExportButton } from '@/components/app/ExportButton'

export default async function ImportPage() {
  const categories = await getCategories()
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Export Excel</h1>
        <p className="text-sm text-muted-foreground mb-4">Téléchargez toutes vos transactions dans un fichier Excel complet : liste détaillée, résumé mensuel et totaux par catégorie.</p>
        <ExportButton />
      </div>

      <div className="border-t pt-6">
        <h1 className="text-2xl font-bold mb-2">Import Excel / CSV</h1>
        <p className="text-sm text-muted-foreground mb-6">Importez vos transactions depuis un fichier de votre banque</p>
        <ImportWizard categories={categories} />
      </div>
    </div>
  )
}
