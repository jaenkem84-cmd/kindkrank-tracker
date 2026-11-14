import { Image, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Person } from '../domain/types';
import { useTheme } from '../theme/ThemeProvider';

export function PersonFace({
  person,
  size,
}: {
  person: Pick<Person, 'name' | 'frameColor' | 'photoUri' | 'avatarIcon'>;
  size: number;
}) {
  const theme = useTheme();
  const letter = person.name.trim().slice(0, 1).toUpperCase() || '?';
  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 3,
    borderColor: person.frameColor,
    backgroundColor: theme.card,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };
  if (person.photoUri) {
    return <Image source={{ uri: person.photoUri }} style={frame} />;
  }
  if (person.avatarIcon) {
    return (
      <View style={frame}>
        <MaterialCommunityIcons name={person.avatarIcon as 'account'} size={Math.round(size * 0.56)} color={person.frameColor} />
      </View>
    );
  }
  return (
    <View style={frame}>
      <Text style={{ color: theme.text, fontSize: size * 0.36, fontWeight: '700' }}>{letter}</Text>
    </View>
  );
}
