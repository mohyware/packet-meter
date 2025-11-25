using System;
using System.Globalization;
using System.Windows.Data;

namespace PacketMeter.UI.Converters
{
    public sealed class EnumEqualsConverter : IValueConverter
    {
        public object? Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is null || parameter is null)
            {
                return false;
            }

            var enumType = value.GetType();
            return Enum.TryParse(enumType, parameter.ToString(), out var parsedValue) &&
                   Equals(value, parsedValue);
        }

        public object? ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool isChecked && isChecked && parameter is not null)
            {
                return Enum.Parse(targetType, parameter.ToString()!);
            }

            return Binding.DoNothing;
        }
    }
}

