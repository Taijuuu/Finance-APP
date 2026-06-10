import { getProfile } from '@/app/actions/profile'
import { getCategories } from '@/app/actions/categories'
import { ProfileForm } from '@/components/app/ProfileForm'
import { CategoryManager } from '@/components/app/CategoryManager'
import { InstallButton } from '@/components/app/InstallButton'
import { Separator } from '@/components/ui/separator'

export default async function ProfilePage() {
  const [profile, categories] = await Promise.all([getProfile(), getCategories()])
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Profil</h1>
      <div className="max-w-lg">
        <ProfileForm profile={profile} />
      </div>
      <Separator />
      <div className="md:hidden">
        <InstallButton variant="card" />
      </div>
      <CategoryManager categories={categories} />
    </div>
  )
}
