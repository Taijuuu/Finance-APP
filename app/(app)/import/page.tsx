import { ExportButton } from '@/components/app/ExportButton'

export default function ImportPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Export Excel</h1>
      <p className="text-sm text-muted-foreground mb-4">Téléchargez toutes vos transactions dans un fichier Excel complet : liste détaillée, résumé mensuel et totaux par catégorie.</p>
      <ExportButton />
    </div>
  )
}
