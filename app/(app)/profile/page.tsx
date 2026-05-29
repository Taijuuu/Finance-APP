import { getProfile } from '@/app/actions/profile'
import { getCategories } from '@/app/actions/categories'
import { ProfileForm } from '@/components/app/ProfileForm'
import { CategoryManager } from '@/components/app/CategoryManager'
import { Separator } from '@/components/ui/separator'

export default async function ProfilePage() {
  const [profile, categories] = await Promise.all([getProfile(), getCategories()])
  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-2xl font-bold">Profil</h1>
      <ProfileForm profile={profile} />
      <Separator />
      <CategoryManager categories={categories} />
    </div>
  )
}
