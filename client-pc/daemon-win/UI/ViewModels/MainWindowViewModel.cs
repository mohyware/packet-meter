using PacketMeter.UI.Commands;
using PacketMeter.UI.Services;
using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Input;
using System.Windows.Media;

namespace PacketMeter.UI.ViewModels
{
    public enum ServerOption
    {
        Cloud,
        Local
    }

    public sealed class MainWindowViewModel : INotifyPropertyChanged
    {
        private readonly ServiceControlService _serviceControlService = new();
        private readonly ConfigService _configService = new();
        private readonly CancellationTokenSource _cts = new();

        private string _tokenInput = string.Empty;
        private string _addTokenButtonText = "Save Settings";
        private ServerOption _selectedServerOption = ServerOption.Cloud;
        private bool _reportPerProcess = true;
        private bool _reportTotal = true;
        private string _serviceName = "PacketMeterDaemon";
        private string _serviceStatus = "Status: idle";
        private Brush _serviceStatusBrush = Brushes.Gainsboro;
        private string _serverHost = "localhost";
        private string _serverPort = "8080";
        private string _reportInterval = "30s";
        private bool _isLoadingConfig = false;

        private const string DEFAULT_CLOUD_HOST = "api.packetmeter.com";
        private const string DEFAULT_CLOUD_PORT = "443";
        private const string DEFAULT_LOCAL_HOST = "localhost";
        private const string DEFAULT_LOCAL_PORT = "8080";

        public MainWindowViewModel()
        {
            AddTokenCommand = new AsyncRelayCommand(_ => OnSaveSettingsAsync());
            RestartServiceCommand = new AsyncRelayCommand(_ => RestartServiceAsync(), _ => !IsRestarting);
            LoadInitialConfigAsync();
        }

        public string TokenInput
        {
            get => _tokenInput;
            set
            {
                if (SetField(ref _tokenInput, value))
                {
                    CommandManager.InvalidateRequerySuggested();
                }
            }
        }

        public string AddTokenButtonText
        {
            get => _addTokenButtonText;
            set => SetField(ref _addTokenButtonText, value);
        }

        public ServerOption SelectedServerOption
        {
            get => _selectedServerOption;
            set
            {
                if (SetField(ref _selectedServerOption, value))
                {
                    PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsLocalServerSelected)));
                    UpdateServerDefaults();
                }
            }
        }

        private void UpdateServerDefaults()
        {
            if (_isLoadingConfig)
                return;

            if (SelectedServerOption == ServerOption.Cloud)
            {
                ServerHost = DEFAULT_CLOUD_HOST;
                ServerPort = DEFAULT_CLOUD_PORT;
            }
            else
            {
                ServerHost = DEFAULT_LOCAL_HOST;
                ServerPort = DEFAULT_LOCAL_PORT;
            }
        }

        public bool IsLocalServerSelected => SelectedServerOption == ServerOption.Local;

        public bool ReportPerProcess
        {
            get => _reportPerProcess;
            set => SetField(ref _reportPerProcess, value);
        }

        public bool ReportTotal
        {
            get => _reportTotal;
            set => SetField(ref _reportTotal, value);
        }

        public string ServiceName
        {
            get => _serviceName;
            set => SetField(ref _serviceName, value);
        }

        public string ServiceStatus
        {
            get => _serviceStatus;
            set => SetField(ref _serviceStatus, value);
        }

        public Brush ServiceStatusBrush
        {
            get => _serviceStatusBrush;
            set => SetField(ref _serviceStatusBrush, value);
        }

        public bool IsRestarting { get; private set; }

        public ICommand AddTokenCommand { get; }

        public ICommand RestartServiceCommand { get; }

        public event PropertyChangedEventHandler? PropertyChanged;

        public string ServerHost
        {
            get => _serverHost;
            set
            {
                if (SetField(ref _serverHost, value))
                {
                    CommandManager.InvalidateRequerySuggested();
                }
            }
        }

        public string ServerPort
        {
            get => _serverPort;
            set
            {
                if (SetField(ref _serverPort, value))
                {
                    CommandManager.InvalidateRequerySuggested();
                }
            }
        }

        public string ReportInterval
        {
            get => _reportInterval;
            set
            {
                if (SetField(ref _reportInterval, value))
                {
                    CommandManager.InvalidateRequerySuggested();
                }
            }
        }

        private async void LoadInitialConfigAsync()
        {
            try
            {
                _isLoadingConfig = true;
                var config = await _configService.GetCurrentConfigAsync(_cts.Token);
                TokenInput = config.Reporter.ApiKey ?? string.Empty;
                ServerHost = config.Reporter.ServerHost;
                ServerPort = config.Reporter.ServerPort.ToString();
                ReportInterval = config.Reporter.ReportInterval;
                ReportPerProcess = config.Reporter.ReportPerProcess;

                if (ServerHost == DEFAULT_CLOUD_HOST || ServerHost.Contains("packetmeter.com"))
                {
                    SelectedServerOption = ServerOption.Cloud;
                }
                else
                {
                    SelectedServerOption = ServerOption.Local;
                }
            }
            catch (Exception ex)
            {
                UpdateServiceStatus($"Failed to load config: {ex.Message}", Brushes.OrangeRed);
            }
            finally
            {
                _isLoadingConfig = false;
            }
        }

        private async Task OnSaveSettingsAsync()
        {
            var trimmedToken = TokenInput?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(ServerHost))
            {
                UpdateServiceStatus("Server host cannot be empty.", Brushes.OrangeRed);
                return;
            }

            if (!int.TryParse(ServerPort, out var parsedPort) || parsedPort <= 0 || parsedPort > 65535)
            {
                UpdateServiceStatus("Server port must be between 1 and 65535.", Brushes.OrangeRed);
                return;
            }

            if (string.IsNullOrWhiteSpace(ReportInterval))
            {
                UpdateServiceStatus("Report interval cannot be empty.", Brushes.OrangeRed);
                return;
            }

            try
            {
                await _configService.SaveReporterSettingsAsync(trimmedToken, ServerHost.Trim(), parsedPort, ReportInterval.Trim(), ReportPerProcess, _cts.Token);
                AddTokenButtonText = "Settings Saved";
                UpdateServiceStatus("Reporter settings saved.", Brushes.LightGreen);
            }
            catch (OperationCanceledException)
            {
                UpdateServiceStatus("Operation cancelled.", Brushes.OrangeRed);
                AddTokenButtonText = "Save Settings";
                return;
            }
            catch (Exception ex)
            {
                AddTokenButtonText = "Failed";
                UpdateServiceStatus($"Failed to save settings: {ex.Message}", Brushes.OrangeRed);
            }

            await Task.Delay(TimeSpan.FromSeconds(2));
            AddTokenButtonText = "Save Settings";
        }

        private async Task RestartServiceAsync()
        {
            if (string.IsNullOrWhiteSpace(ServiceName))
            {
                UpdateServiceStatus("Please specify a service name.", Brushes.OrangeRed);
                return;
            }

            try
            {
                IsRestarting = true;
                RaiseCanExecuteChanged();
                UpdateServiceStatus($"Restarting '{ServiceName}'...", Brushes.Gold);
                await _serviceControlService.RestartAsync(ServiceName, _cts.Token);
                UpdateServiceStatus($"Service '{ServiceName}' restarted successfully.", Brushes.LightGreen);
            }
            catch (Exception ex)
            {
                UpdateServiceStatus($"Failed: {ex.Message}", Brushes.OrangeRed);
            }
            finally
            {
                IsRestarting = false;
                RaiseCanExecuteChanged();
            }
        }

        private void UpdateServiceStatus(string message, Brush brush)
        {
            ServiceStatus = message;
            ServiceStatusBrush = brush;
        }

        private void RaiseCanExecuteChanged()
        {
            CommandManager.InvalidateRequerySuggested();
        }

        private bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
        {
            if (Equals(field, value))
            {
                return false;
            }

            field = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
            return true;
        }
    }
}

