import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

/** One line weight and size for every symptom mark. */
export function SymptomGlyph({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  return <MaterialCommunityIcons name={name as 'pill'} size={size} color={color} />;
}
