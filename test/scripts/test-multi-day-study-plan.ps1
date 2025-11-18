# Test du Plan de Révision Multi-Jours
# Ce script teste la génération d'un plan de révision étalé sur plusieurs jours

Write-Host "=== TEST DU PLAN DE REVISION MULTI-JOURS ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$baseUrl = "http://localhost:3000"
$chapterId = "1763372913807-6n1kpat2l"  # Remplacer par un ID de chapitre valide

# Calculer les dates de test
$today = Get-Date
$exam3Days = ($today.AddDays(3)).ToString("yyyy-MM-dd")
$exam7Days = ($today.AddDays(7)).ToString("yyyy-MM-dd")
$exam14Days = ($today.AddDays(14)).ToString("yyyy-MM-dd")

Write-Host "📅 Dates de test:" -ForegroundColor Yellow
Write-Host "   Aujourd'hui: $($today.ToString('yyyy-MM-dd'))"
Write-Host "   Examen dans 3 jours: $exam3Days"
Write-Host "   Examen dans 7 jours: $exam7Days"
Write-Host "   Examen dans 14 jours: $exam14Days"
Write-Host ""

# Fonction pour tester un scénario
function Test-StudyPlan {
    param(
        [string]$examDate,
        [int]$expectedDays,
        [string]$scenario
    )
    
    Write-Host "🧪 Test: $scenario" -ForegroundColor Cyan
    Write-Host "   Date d'examen: $examDate"
    Write-Host "   Jours attendus: $expectedDays"
    
    $body = @{
        chapterId = $chapterId
        examDate = $examDate
        dailyTime = 60
        objective = "Review Everything"
        language = "FR"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/study-plan/generate" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -TimeoutSec 30
        
        if ($response.success) {
            $actualDays = $response.studyPlan.dailySchedule.Count
            $metadata = $response.metadata
            
            Write-Host "   ✅ Succès!" -ForegroundColor Green
            Write-Host "   📊 Résultats:" -ForegroundColor White
            Write-Host "      - Jours générés: $actualDays" -ForegroundColor $(if ($actualDays -eq $expectedDays) { "Green" } else { "Red" })
            Write-Host "      - Jours calculés (metadata): $($metadata.daysUntilExam)"
            Write-Host "      - Score étudiant: $($metadata.studentScore)/100"
            Write-Host "      - Précision: $($metadata.accuracy)%"
            
            # Vérifier la continuité des jours
            $days = $response.studyPlan.dailySchedule | ForEach-Object { $_.day }
            $continuous = $true
            for ($i = 0; $i -lt $days.Count; $i++) {
                if ($days[$i] -ne ($i + 1)) {
                    $continuous = $false
                    break
                }
            }
            
            if ($continuous) {
                Write-Host "      - Jours continus: ✅ Oui" -ForegroundColor Green
            } else {
                Write-Host "      - Jours continus: ❌ Non" -ForegroundColor Red
            }
            
            # Afficher les premiers jours
            Write-Host "   📅 Aperçu des sessions:" -ForegroundColor White
            $response.studyPlan.dailySchedule | Select-Object -First 3 | ForEach-Object {
                Write-Host "      Jour $($_.day) ($($_.date)): $($_.focus)" -ForegroundColor Gray
            }
            
            if ($actualDays -gt 3) {
                Write-Host "      ... ($($actualDays - 3) autres jours)" -ForegroundColor Gray
            }
            
            # Vérification
            if ($actualDays -eq $expectedDays -and $continuous) {
                Write-Host "   ✅ TEST RÉUSSI" -ForegroundColor Green
                return $true
            } else {
                Write-Host "   ❌ TEST ÉCHOUÉ: Nombre de jours incorrect ou non continus" -ForegroundColor Red
                return $false
            }
        } else {
            Write-Host "   ❌ Erreur: $($response.error)" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "   ❌ Erreur HTTP: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    
    Write-Host ""
}

# Exécuter les tests
Write-Host "🚀 Démarrage des tests..." -ForegroundColor Cyan
Write-Host ""

$results = @()

# Test 1: 3 jours
$results += Test-StudyPlan -examDate $exam3Days -expectedDays 3 -scenario "Examen dans 3 jours"

# Test 2: 7 jours
$results += Test-StudyPlan -examDate $exam7Days -expectedDays 7 -scenario "Examen dans 7 jours"

# Test 3: 14 jours
$results += Test-StudyPlan -examDate $exam14Days -expectedDays 14 -scenario "Examen dans 14 jours"

# Résumé
Write-Host ""
Write-Host "=== RÉSUMÉ DES TESTS ===" -ForegroundColor Cyan
$passed = ($results | Where-Object { $_ -eq $true }).Count
$total = $results.Count
Write-Host "Tests réussis: $passed/$total" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })

if ($passed -eq $total) {
    Write-Host ""
    Write-Host "🎉 TOUS LES TESTS SONT RÉUSSIS!" -ForegroundColor Green
    Write-Host "Le système génère correctement des plans de révision multi-jours." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️ Certains tests ont échoué. Vérifiez les logs ci-dessus." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Note: Assurez-vous que:" -ForegroundColor Yellow
Write-Host "   1. Le serveur Next.js est en cours d'exécution (npm run dev)" -ForegroundColor Gray
Write-Host "   2. Vous êtes authentifié dans le navigateur" -ForegroundColor Gray
Write-Host "   3. Le chapitre existe et le quiz est complété" -ForegroundColor Gray
Write-Host "   4. Votre clé API OpenAI est configurée" -ForegroundColor Gray
