'use client';

import { useParams } from 'next/navigation';
import { RecipeEditor } from '@/components/recipe-editor/RecipeEditor';

export default function EditRecipePage() {
  const { id } = useParams<{ id: string }>();
  return <RecipeEditor mode="edit" id={id} />;
}
