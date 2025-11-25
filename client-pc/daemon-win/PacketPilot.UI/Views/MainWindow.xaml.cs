using System.Diagnostics;
using System.Windows;
using System.Windows.Input;
using PacketPilot.UI.ViewModels;

namespace PacketPilot.UI.Views
{
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
            DataContext ??= new MainWindowViewModel();
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }

        private void Border_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ButtonState == MouseButtonState.Pressed)
            {
                DragMove();
            }
        }

        private void Hyperlink_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Documents.Hyperlink hyperlink)
            {
                var uri = hyperlink.NavigateUri?.ToString();
                if (!string.IsNullOrEmpty(uri))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = uri,
                        UseShellExecute = true
                    });
                }
            }
        }
    }
}

