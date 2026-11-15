import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Text style={{ color: theme.muted, fontSize: 12, width: 78 }}>{label}</Text>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: 32,
              paddingHorizontal: 10,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? theme.accent : 'transparent',
              borderWidth: 1,
              borderColor: selected ? theme.accent : theme.border,
            }}
          >
            <Text style={{ color: selected ? theme.onAccent : theme.text, fontSize: 13, fontWeight: '600' }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
